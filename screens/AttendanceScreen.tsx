import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { supabase } from '../lib/supabase';
import GeofenceService from '../services/GeofenceService';
import AttendanceService, { ERRORS } from '../services/AttendanceService';
import { useTheme } from '@/hooks/use-theme';
import NexusLoader from '@/components/NexusLoader';
import { GlassmorphicCard, NexusStatusBar, GeofenceRadar, AttendanceButton, ProxyAlert, ARClassroomFinder, EchoVoice, ChronosReplay, NexusNetwork } from '../components/nexus';
import { NexusColors, NexusFonts, NexusSpacing, NexusRadius } from '../constants/theme';
import type { LocationResult, GeofenceCheckResult, Class, Profile, AttendanceLog } from '../types';

// ── Instructor-specific types ─────────────────────────────────────────────────
type StudentCheckInStatus = 'checked-in' | 'pending' | 'absent' | 'proxy-risk';

interface EnrolledStudent {
  id: string;
  full_name: string;
  student_id?: string;
  status: StudentCheckInStatus;
  checkedInAt?: string;
}

interface ProxyAlertItem {
  id: string;
  studentName: string;
  reason: string;
  studentId: string;
}

// ── Signal bar helper (static placeholder — real signal requires native APIs) ──
function SignalBars({ level, color }: { level: number; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
      {[1, 2, 3, 4].map((bar) => (
        <View
          key={bar}
          style={{
            width: 4,
            height: 4 + bar * 3,
            borderRadius: 1,
            backgroundColor: bar <= level ? color : NexusColors.textDisabled,
          }}
        />
      ))}
    </View>
  );
}

export default function AttendanceScreen() {
  const { colors, isDark } = useTheme();
  const { classId: raw } = useLocalSearchParams<{ classId: string }>();
  const classId = Array.isArray(raw) ? raw[0] : raw ?? '';

  // ── Shared state ──────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<Profile | null>(null);
  const [locationResult, setLocationResult] = useState<LocationResult | null>(null);
  const [geofenceResult, setGeofenceResult] = useState<GeofenceCheckResult | null>(null);
  const [geofence, setGeofence] = useState<{ lat: number; lng: number; radius_m: number } | null>(null);
  const [classData, setClassData] = useState<Class | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [status, setStatus] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cameraRef = useRef<CameraView>(null);

  // ── Instructor Nexus state ────────────────────────────────────────────────
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [proxyAlerts, setProxyAlerts] = useState<ProxyAlertItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // ── Student Nexus state ───────────────────────────────────────────────────
  const [gpsState, setGpsState] = useState<'active' | 'searching' | 'disabled'>('searching');
  const [sessionActive, setSessionActive] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [checkedInCount, setCheckedInCount] = useState(0);
  // Phase 3 modal state
  const [showAR, setShowAR]             = useState(false);
  const [showEcho, setShowEcho]         = useState(false);
  const [showChronos, setShowChronos]   = useState(false);
  const [showNetwork, setShowNetwork]   = useState(false);

  // Load profile to determine role
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => { if (data) setProfile(data); });
    });
  }, []);

  useEffect(() => {
    if (!classId) { setInitializing(false); return; }
    supabase.from('classes').select('*')
      .eq('id', classId).single()
      .then(({ data }) => {
        if (data) {
          setClassData(data);
          setGeofence({ lat: data.geofence_lat, lng: data.geofence_lng, radius_m: data.geofence_radius_m });
        }
        setInitializing(false);
      });
  }, [classId]);

  // Load session active state and checked-in count
  useEffect(() => {
    if (!classId) return;
    supabase.from('class_sessions')
      .select('id, is_active')
      .eq('class_id', classId)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data: session }) => {
        setSessionActive(session?.is_active ?? false);
        if (session?.id) {
          supabase.from('attendance_logs')
            .select('id', { count: 'exact' })
            .eq('session_id', session.id)
            .then(({ count }) => setCheckedInCount(count ?? 0));
        }
      });
  }, [classId]);

  // ── Instructor: load enrolled students + attendance logs ──────────────────
  useEffect(() => {
    if (!classId || profile?.role !== 'instructor') return;

    async function loadInstructorData() {
      // 1. Find active session
      const { data: session } = await supabase
        .from('class_sessions')
        .select('id')
        .eq('class_id', classId)
        .eq('is_active', true)
        .maybeSingle();

      const sessionId = session?.id ?? null;
      setActiveSessionId(sessionId);

      // 2. Load enrolled students with their profiles
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('student_id, profiles(id, full_name, student_id)')
        .eq('class_id', classId);

      if (!enrollments) return;

      // 3. Load attendance logs for this session
      let logs: AttendanceLog[] = [];
      if (sessionId) {
        const { data: logData } = await supabase
          .from('attendance_logs')
          .select('*')
          .eq('session_id', sessionId);
        logs = (logData as AttendanceLog[]) ?? [];
      }

      // 4. Detect proxy risk: same lat/lng across multiple students
      const coordKey = (log: AttendanceLog) =>
        `${log.latitude.toFixed(5)},${log.longitude.toFixed(5)}`;
      const coordGroups: Record<string, string[]> = {};
      for (const log of logs) {
        const key = coordKey(log);
        if (!coordGroups[key]) coordGroups[key] = [];
        coordGroups[key].push(log.student_id);
      }
      const proxyStudentIds = new Set<string>();
      for (const [, ids] of Object.entries(coordGroups)) {
        if (ids.length > 1) ids.forEach((id) => proxyStudentIds.add(id));
      }

      // 5. Build student list
      const students: EnrolledStudent[] = enrollments.map((e: any) => {
        const prof = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles;
        const studentId: string = e.student_id;
        const log = logs.find((l) => l.student_id === studentId);
        let status: StudentCheckInStatus = sessionId ? 'absent' : 'pending';
        if (log) {
          status = proxyStudentIds.has(studentId) ? 'proxy-risk' : 'checked-in';
        }
        return {
          id: studentId,
          full_name: prof?.full_name ?? 'Unknown',
          student_id: prof?.student_id,
          status,
          checkedInAt: log?.signed_at,
        };
      });

      setEnrolledStudents(students);

      // 6. Build proxy alerts
      const alerts: ProxyAlertItem[] = students
        .filter((s) => s.status === 'proxy-risk')
        .map((s) => ({
          id: s.id,
          studentName: s.full_name,
          reason: '2 devices detected at same coordinates',
          studentId: s.id,
        }));
      setProxyAlerts(alerts);
    }

    loadInstructorData();
  }, [classId, profile]);

  async function poll() {
    const result = await GeofenceService.getCurrentLocation();
    setLocationResult(result);
    if (result.success) {
      setGpsState('active');
      if (geofence) {
        setGeofenceResult(GeofenceService.isWithinGeofence(result.coords, {
          latitude: geofence.lat, longitude: geofence.lng, radius_m: geofence.radius_m,
        }));
      }
    } else {
      setGpsState(result.error === 'permission_denied' ? 'disabled' : 'searching');
    }
  }

  useEffect(() => {
    if (!geofence) return;
    poll();
    intervalRef.current = setInterval(poll, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [geofence]);

  const accuracy = locationResult?.success ? locationResult.accuracyMetres : null;
  const accuracyOk = accuracy != null && GeofenceService.isAccuracyAcceptable(accuracy);
  const inside = geofenceResult?.inside === true;
  const canMark = !!locationResult && accuracyOk && inside && !loading;
  const isSuccess = status === 'Attendance marked successfully!';
  const requiresSelfie = classData?.selfie_required === true;

  async function handleMark() {
    if (!classId || !classData) return;
    
    // If selfie is required, show camera first
    if (requiresSelfie && !cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) {
        Alert.alert('Camera Permission Required', 'Please allow camera access to take a selfie for attendance verification.');
        return;
      }
    }
    
    if (requiresSelfie) {
      setShowCamera(true);
      return;
    }
    
    // Mark attendance without selfie
    await submitAttendance();
  }

  async function takeSelfie() {
    if (!cameraRef.current) return;
    
    try {
      setLoading(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: false,
      });
      
      if (photo) {
        await submitAttendance(photo.uri);
      }
    } catch (error) {
      console.error('Error taking selfie:', error);
      Alert.alert('Error', 'Failed to take selfie. Please try again.');
    } finally {
      setShowCamera(false);
      setLoading(false);
    }
  }

  async function submitAttendance(selfieUri?: string) {
    if (!classId) return;
    setLoading(true); 
    setStatus('');
    
    try {
      let selfieUrl: string | undefined;
      
      // Upload selfie if provided
      if (selfieUri) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const fileName = `${Date.now()}-${user.id}.jpg`;
          const formData = new FormData();
          formData.append('file', {
            uri: selfieUri,
            type: 'image/jpeg',
            name: fileName,
          } as any);
          
          const { data, error } = await supabase.storage
            .from('selfies')
            .upload(`${classId}/${fileName}`, formData, {
              contentType: 'image/jpeg',
            });
          
          if (error) {
            console.error('Selfie upload error:', error);
            Alert.alert('Error', 'Failed to upload selfie. Please try again.');
            return;
          }
          
          if (data) {
            const { data: { publicUrl } } = supabase.storage
              .from('selfies')
              .getPublicUrl(data.path);
            selfieUrl = publicUrl;
          }
        }
      }
      
      const result = await AttendanceService.markAttendance(classId, selfieUrl);
      if (result.success) {
        setStatus('Attendance marked successfully!');
        setConfirmed(true);
      } else {
        setStatus(ERRORS[result.reason] ?? ERRORS.server_error);
      }
    } catch (error) {
      console.error('Attendance submission error:', error);
      setStatus(ERRORS.server_error);
    } finally {
      setLoading(false);
    }
  }

  if (initializing) return <NexusLoader />;

  const isInstructor = profile?.role === 'instructor';

  // ── Camera view (shared between branches) ────────────────────────────────
  if (showCamera) {
    const s = makeStyles(colors, isDark);
    return (
      <View style={s.root}>
        <View style={s.header}>
          <View style={s.headerTop}>
            <TouchableOpacity onPress={() => setShowCamera(false)}>
              <Text style={s.backButtonText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.headerTitle}>Take Selfie</Text>
            <View style={{ width: 60 }} />
          </View>
        </View>
        <View style={s.cameraContainer}>
          <CameraView ref={cameraRef} style={s.camera} facing={CameraType.front} />
          <View style={s.cameraControls}>
            <TouchableOpacity style={s.captureButton} onPress={takeSelfie} disabled={loading}>
              <View style={s.captureButtonInner} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ── INSTRUCTOR BRANCH — Nexus Geofence Management ────────────────────────
  if (isInstructor) {
    const geofenceCenter = geofence
      ? { lat: geofence.lat, lng: geofence.lng }
      : { lat: 0, lng: 0 };
    const geofenceRadius = geofence?.radius_m ?? 100;

    function dismissProxyAlert(id: string) {
      setProxyAlerts((prev) => prev.filter((a) => a.id !== id));
    }

    function investigateStudent(studentId: string) {
      const student = enrolledStudents.find((s) => s.id === studentId);
      Alert.alert(
        'Student Attendance Detail',
        `Viewing attendance record for ${student?.full_name ?? 'student'}.\n\nStudent ID: ${student?.student_id ?? studentId}`,
        [{ text: 'Close' }]
      );
    }

    function StatusIcon({ status }: { status: StudentCheckInStatus }) {
      switch (status) {
        case 'checked-in':
          return <Text style={ins.statusIconChecked}>✓</Text>;
        case 'pending':
          return <Text style={ins.statusIconPending}>⏳</Text>;
        case 'absent':
          return <Text style={ins.statusIconAbsent}>✗</Text>;
        case 'proxy-risk':
          return <Text style={ins.statusIconProxy}>⚠</Text>;
      }
    }

    function formatTime(iso?: string) {
      if (!iso) return '';
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    return (
      <View style={ins.root}>
        <NexusStatusBar gpsState={gpsState} ntpSynced={true} />

        {/* Top bar */}
        <View style={ins.topBar}>
          <Text style={ins.topBarTitle}>GEOFENCE MANAGEMENT</Text>
          {classData && (
            <Text style={ins.topBarSub}>{classData.course_code}</Text>
          )}
        </View>

        <ScrollView contentContainerStyle={ins.scrollContent} showsVerticalScrollIndicator={false}>

          {/* 10.4 — Geofence map card */}
          <GlassmorphicCard style={ins.mapCard} glowColor={NexusColors.borderGlow}>
            <View style={ins.mapHeader}>
              <Ionicons name="map-outline" size={16} color={NexusColors.accentCyan} />
              <Text style={ins.mapTitle}>ACTIVE GEOFENCE</Text>
              {geofence && (
                <Text style={ins.mapRadius}>r = {geofence.radius_m}m</Text>
              )}
            </View>
            {/* Geofence visual: concentric circles representing the boundary */}
            <View style={ins.mapCanvas}>
              {/* Outer boundary ring */}
              <View style={ins.geofenceOuter} />
              {/* Middle ring */}
              <View style={ins.geofenceMiddle} />
              {/* Center dot */}
              <View style={ins.geofenceCenter} />
              {/* Crosshair lines */}
              <View style={ins.crosshairH} />
              <View style={ins.crosshairV} />
              {/* Coordinate label */}
              {geofence && (
                <View style={ins.coordLabel}>
                  <Text style={ins.coordText}>
                    {geofence.lat.toFixed(4)}°, {geofence.lng.toFixed(4)}°
                  </Text>
                </View>
              )}
            </View>
            <View style={ins.mapLegend}>
              <View style={ins.legendItem}>
                <View style={[ins.legendDot, { backgroundColor: NexusColors.accentCyan }]} />
                <Text style={ins.legendText}>Geofence boundary</Text>
              </View>
              <View style={ins.legendItem}>
                <View style={[ins.legendDot, { backgroundColor: NexusColors.accentEmerald }]} />
                <Text style={ins.legendText}>Center point</Text>
              </View>
            </View>
          </GlassmorphicCard>

          {/* 10.2 — Student status list */}
          <GlassmorphicCard style={ins.studentListCard}>
            <View style={ins.sectionHeader}>
              <Ionicons name="people-outline" size={16} color={NexusColors.accentCyan} />
              <Text style={ins.sectionTitle}>ENROLLED STUDENTS</Text>
              <Text style={ins.sectionCount}>{enrolledStudents.length}</Text>
            </View>

            {enrolledStudents.length === 0 ? (
              <Text style={ins.emptyText}>No enrolled students found</Text>
            ) : (
              enrolledStudents.map((student, idx) => (
                <View
                  key={student.id}
                  style={[
                    ins.studentRow,
                    idx < enrolledStudents.length - 1 && ins.studentRowBorder,
                  ]}
                >
                  <View style={[ins.statusBadge, ins[`statusBadge_${student.status.replace('-', '_')}`]]}>
                    <StatusIcon status={student.status} />
                  </View>
                  <View style={ins.studentInfo}>
                    <Text style={ins.studentName}>{student.full_name}</Text>
                    {student.student_id && (
                      <Text style={ins.studentSubId}>{student.student_id}</Text>
                    )}
                  </View>
                  <View style={ins.studentRight}>
                    {student.status === 'checked-in' && student.checkedInAt ? (
                      <Text style={ins.checkedInTime}>{formatTime(student.checkedInAt)}</Text>
                    ) : (
                      <Text style={ins[`statusLabel_${student.status.replace('-', '_')}`]}>
                        {student.status === 'pending' ? 'pending' :
                         student.status === 'absent' ? 'absent' : 'proxy risk'}
                      </Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </GlassmorphicCard>

          {/* 10.3 — ProxyAlert cards */}
          {proxyAlerts.length > 0 && (
            <View style={ins.proxySection}>
              {proxyAlerts.map((alert) => (
                <ProxyAlert
                  key={alert.id}
                  studentName={alert.studentName}
                  reason={alert.reason}
                  onInvestigate={() => investigateStudent(alert.studentId)}
                  onDismiss={() => dismissProxyAlert(alert.id)}
                />
              ))}
            </View>
          )}

        </ScrollView>
      </View>
    );
  }

  // ── STUDENT BRANCH — Nexus Geospatial Hub ─────────────────────────────────
  const studentCoords = locationResult?.success
    ? { lat: locationResult.coords.latitude, lng: locationResult.coords.longitude }
    : null;
  const geofenceCenter = geofence
    ? { lat: geofence.lat, lng: geofence.lng }
    : { lat: 0, lng: 0 };
  const distanceMetres = geofenceResult && !geofenceResult.inside
    ? (geofenceResult as any).distanceMetres ?? 0
    : 0;
  const geofenceRadius = geofence?.radius_m ?? 100;
  const proximityProgress = inside
    ? 1
    : Math.max(0, 1 - distanceMetres / (geofenceRadius * 3));

  return (
    <View style={nx.root}>
      {/* 6.2 — NexusStatusBar + compass heading */}
      <NexusStatusBar gpsState={gpsState} ntpSynced={true} />
      <View style={nx.topBar}>
        <Text style={nx.topBarTitle}>RADAR HUB</Text>
        <View style={nx.compassBadge}>
          <Ionicons name="compass-outline" size={14} color={NexusColors.accentCyan} />
          <Text style={nx.compassText}>N • 0°</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={nx.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 6.3 — GeofenceRadar as primary visual */}
        <View style={nx.radarWrapper}>
          <GeofenceRadar
            studentCoords={studentCoords}
            geofenceCenter={geofenceCenter}
            geofenceRadius={geofenceRadius}
            sessionActive={sessionActive}
          />
        </View>

        {/* 6.4 — Glass card overlay: room, floor, signal bars, checked-in count */}
        <GlassmorphicCard style={nx.infoCard} glowColor={NexusColors.borderGlow}>
          <View style={nx.infoRow}>
            <View style={nx.infoItem}>
              <Text style={nx.infoLabel}>ROOM</Text>
              <Text style={nx.infoValue}>{classData ? '402' : '—'}</Text>
            </View>
            <View style={nx.infoItem}>
              <Text style={nx.infoLabel}>FLOOR</Text>
              <Text style={nx.infoValue}>4</Text>
            </View>
            <View style={nx.infoItem}>
              <Text style={nx.infoLabel}>CHECKED IN</Text>
              <Text style={nx.infoValue}>{checkedInCount}</Text>
            </View>
          </View>
          <View style={nx.signalRow}>
            <View style={nx.signalItem}>
              <Text style={nx.signalLabel}>WiFi</Text>
              <SignalBars level={3} color={NexusColors.accentCyan} />
            </View>
            <View style={nx.signalItem}>
              <Text style={nx.signalLabel}>GPS</Text>
              <SignalBars level={accuracyOk ? 4 : gpsState === 'searching' ? 2 : 1} color={NexusColors.accentCyan} />
            </View>
            <View style={nx.signalItem}>
              <Text style={nx.signalLabel}>BLE</Text>
              <SignalBars level={2} color={NexusColors.accentCyan} />
            </View>
          </View>
          {classData && (
            <Text style={nx.classNameText}>{classData.name} · {classData.course_code}</Text>
          )}
        </GlassmorphicCard>

        {/* 6.5 — Distance progress bar */}
        <GlassmorphicCard style={nx.progressCard}>
          <View style={nx.progressHeader}>
            <Text style={nx.progressLabel}>PROXIMITY TO GEOFENCE</Text>
            <Text style={nx.progressDistance}>
              {inside ? 'Inside ✓' : `${Math.round(distanceMetres)}m away`}
            </Text>
          </View>
          <View style={nx.progressTrack}>
            <View
              style={[
                nx.progressFill,
                {
                  width: `${Math.round(proximityProgress * 100)}%` as any,
                  backgroundColor: inside
                    ? NexusColors.accentEmerald
                    : proximityProgress > 0.6
                    ? NexusColors.accentAmber
                    : NexusColors.accentRose,
                },
              ]}
            />
          </View>

          {/* 6.7 — Error message from ERRORS map */}
          {status !== '' && !isSuccess && (
            <View style={nx.errorBanner}>
              <Ionicons name="warning-outline" size={14} color={NexusColors.accentRose} />
              <Text style={nx.errorText}>{status}</Text>
            </View>
          )}
          {isSuccess && (
            <View style={nx.successBanner}>
              <Ionicons name="checkmark-circle-outline" size={14} color={NexusColors.accentEmerald} />
              <Text style={nx.successText}>Attendance marked successfully!</Text>
            </View>
          )}

          {/* 6.6 — AttendanceButton wired to AttendanceService.markAttendance */}
          <View style={nx.buttonWrapper}>
            <AttendanceButton
              onPress={handleMark}
              disabled={!inside || !accuracyOk || !sessionActive}
              loading={loading}
              confirmed={confirmed}
            />
          </View>
        </GlassmorphicCard>

        {/* ── Phase 3: Quick-action toolbar ── */}
        <View style={nx.p3Toolbar}>
          {[
            { icon: 'navigate-circle-outline' as const, label: 'AR Find',  onPress: () => setShowAR(true) },
            { icon: 'mic-outline'             as const, label: 'Echo',     onPress: () => setShowEcho(true) },
            { icon: 'time-outline'            as const, label: 'Chronos',  onPress: () => setShowChronos(true) },
            { icon: 'wifi-outline'            as const, label: 'Network',  onPress: () => setShowNetwork(true) },
          ].map((btn) => (
            <TouchableOpacity key={btn.label} style={nx.p3Btn} onPress={btn.onPress} activeOpacity={0.8}>
              <Ionicons name={btn.icon} size={22} color={NexusColors.accentCyan} />
              <Text style={nx.p3BtnLabel}>{btn.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* ── Phase 3 modals ── */}
      <ARClassroomFinder
        destination={classData ? `${classData.name} · Room 402` : 'Classroom'}
        distanceMetres={inside ? 3 : 45}
        visible={showAR}
        onClose={() => setShowAR(false)}
      />
      <EchoVoice
        visible={showEcho}
        onClose={() => setShowEcho(false)}
        onMarkAttendance={handleMark}
      />
      <ChronosReplay
        visible={showChronos}
        onClose={() => setShowChronos(false)}
        sessionName={classData?.name ?? 'Current Session'}
        role="student"
      />
      <NexusNetwork
        visible={showNetwork}
        onClose={() => setShowNetwork(false)}
        isOnline={gpsState !== 'disabled'}
      />
    </View>
  );
}

function makeStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    header: {
      backgroundColor: colors.card,
      paddingTop: 50,
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      color: 'white',
      fontSize: 14,
      fontWeight: 'bold',
    },
    scroll: { padding: 20, paddingBottom: 40 },
    greeting: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 20,
    },

    // GPS Card - Dark Teal Background
    gpsCard: {
      backgroundColor: '#1E4D4D',
      borderRadius: 20,
      padding: 24,
      marginBottom: 20,
    },
    gpsHeader: {
      alignItems: 'center',
      marginBottom: 20,
    },
    gpsTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#fff',
      marginTop: 8,
      letterSpacing: 2,
    },
    gpsStatus: {
      marginBottom: 20,
      gap: 12,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    statusText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#fff',
    },
    sessionDetails: {
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      gap: 10,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    detailText: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.9)',
    },
    progressBar: {
      height: 6,
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressFill: {
      height: 6,
      backgroundColor: '#22C55E',
      borderRadius: 3,
    },

    card: {
      backgroundColor: colors.card, borderRadius: 18, padding: 18,
      marginBottom: 14, borderWidth: 1, borderColor: colors.cardBorder,
    },
    cardLabel: { fontSize: 10, fontWeight: '700', color: colors.subtext, letterSpacing: 1.5, marginBottom: 12 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    bigVal: { fontSize: 18, fontWeight: '800' },
    hint: { fontSize: 12, color: colors.subtext },
    muted: { fontSize: 14, color: colors.subtext },

    checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 7 },
    checkCircle: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    checkOk: { backgroundColor: colors.primary },
    checkPending: { backgroundColor: isDark ? '#2A2A3E' : '#F1F5F9' },
    checkMark: { color: '#fff', fontSize: 13, fontWeight: '800' },
    checkLabel: { fontSize: 14, fontWeight: '500' },

    banner: { borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1 },
    bannerOk: { backgroundColor: isDark ? '#0A2A0A' : '#DCFCE7', borderColor: '#22C55E' },
    bannerErr: { backgroundColor: isDark ? '#2A0A0A' : '#FEE2E2', borderColor: '#EF4444' },
    bannerText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },

    btn: {
      backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 18,
      alignItems: 'center', shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 12, elevation: 4,
    },
    btnOff: { backgroundColor: isDark ? '#1A1A2E' : '#F1F5F9', shadowOpacity: 0 },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

    // Camera styles
    backButton: { padding: 8 },
    backButtonText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
    cameraContainer: { flex: 1, position: 'relative' },
    camera: { flex: 1 },
    cameraControls: {
      position: 'absolute',
      bottom: 50,
      left: 0,
      right: 0,
      alignItems: 'center',
    },
    captureButton: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: 'rgba(255,255,255,0.3)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 4,
      borderColor: 'white',
    },
    captureButtonInner: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: 'white',
    },
  });
}

// ── Nexus student styles ──────────────────────────────────────────────────────
const nx = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: NexusColors.bgPrimary,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: NexusSpacing.xl,
    paddingVertical: NexusSpacing.md,
    backgroundColor: NexusColors.bgCardSolid,
    borderBottomWidth: 1,
    borderBottomColor: NexusColors.borderGlass,
  },
  topBarTitle: {
    fontSize: NexusFonts.sizes.md,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textPrimary,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
  compassBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.xs,
    backgroundColor: NexusColors.bgCard,
    borderWidth: 1,
    borderColor: NexusColors.borderGlow,
    borderRadius: NexusRadius.full,
    paddingHorizontal: NexusSpacing.md,
    paddingVertical: NexusSpacing.xs,
  },
  compassText: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.semibold,
    color: NexusColors.accentCyan,
    letterSpacing: NexusFonts.letterSpacing.wide,
  },
  scrollContent: {
    padding: NexusSpacing.xl,
    paddingBottom: NexusSpacing['3xl'],
    alignItems: 'center',
  },
  radarWrapper: {
    marginBottom: NexusSpacing['2xl'],
    alignItems: 'center',
  },
  infoCard: {
    width: '100%',
    padding: NexusSpacing.lg,
    marginBottom: NexusSpacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: NexusSpacing.md,
  },
  infoItem: {
    alignItems: 'center',
    gap: NexusSpacing.xs,
  },
  infoLabel: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.semibold,
    color: NexusColors.textSecondary,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
  infoValue: {
    fontSize: NexusFonts.sizes.xl,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textPrimary,
  },
  signalRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: NexusSpacing.md,
    borderTopWidth: 1,
    borderTopColor: NexusColors.borderGlass,
    marginBottom: NexusSpacing.md,
  },
  signalItem: {
    alignItems: 'center',
    gap: NexusSpacing.xs,
  },
  signalLabel: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
    fontWeight: NexusFonts.weights.medium,
  },
  classNameText: {
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.textSecondary,
    textAlign: 'center',
    marginTop: NexusSpacing.xs,
  },
  progressCard: {
    width: '100%',
    padding: NexusSpacing.lg,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: NexusSpacing.sm,
  },
  progressLabel: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.semibold,
    color: NexusColors.textSecondary,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
  progressDistance: {
    fontSize: NexusFonts.sizes.sm,
    fontWeight: NexusFonts.weights.semibold,
    color: NexusColors.textPrimary,
  },
  progressTrack: {
    height: 6,
    backgroundColor: NexusColors.borderGlass,
    borderRadius: NexusRadius.full,
    overflow: 'hidden',
    marginBottom: NexusSpacing.lg,
  },
  progressFill: {
    height: 6,
    borderRadius: NexusRadius.full,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.xs,
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    borderRadius: NexusRadius.md,
    padding: NexusSpacing.md,
    marginBottom: NexusSpacing.lg,
  },
  errorText: {
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.accentRose,
    fontWeight: NexusFonts.weights.medium,
    flex: 1,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.xs,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: NexusRadius.md,
    padding: NexusSpacing.md,
    marginBottom: NexusSpacing.lg,
  },
  successText: {
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.accentEmerald,
    fontWeight: NexusFonts.weights.medium,
    flex: 1,
  },
  buttonWrapper: {
    alignItems: 'center',
  },
  // Phase 3 toolbar
  p3Toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: NexusColors.bgCardSolid,
    borderRadius: NexusRadius.xl,
    borderWidth: 1,
    borderColor: NexusColors.borderGlass,
    paddingVertical: NexusSpacing.lg,
    marginTop: NexusSpacing.lg,
    width: '100%',
  },
  p3Btn: {
    alignItems: 'center',
    gap: NexusSpacing.xs,
  },
  p3BtnLabel: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.semibold,
    color: NexusColors.textSecondary,
    letterSpacing: NexusFonts.letterSpacing.wide,
  },
});

// ── Nexus instructor styles ───────────────────────────────────────────────────
const ins = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: NexusColors.bgPrimary,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: NexusSpacing.xl,
    paddingVertical: NexusSpacing.md,
    backgroundColor: NexusColors.bgCardSolid,
    borderBottomWidth: 1,
    borderBottomColor: NexusColors.borderGlass,
  },
  topBarTitle: {
    fontSize: NexusFonts.sizes.md,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textPrimary,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
  topBarSub: {
    fontSize: NexusFonts.sizes.sm,
    fontWeight: NexusFonts.weights.medium,
    color: NexusColors.accentCyan,
    letterSpacing: NexusFonts.letterSpacing.wide,
  },
  scrollContent: {
    padding: NexusSpacing.xl,
    paddingBottom: NexusSpacing['3xl'],
    gap: NexusSpacing.lg,
  },

  // ── Map card ──────────────────────────────────────────────────────────────
  mapCard: {
    padding: NexusSpacing.lg,
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.sm,
    marginBottom: NexusSpacing.md,
  },
  mapTitle: {
    flex: 1,
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textSecondary,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
  mapRadius: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.medium,
    color: NexusColors.accentCyan,
  },
  mapCanvas: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: NexusSpacing.md,
  },
  geofenceOuter: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: NexusRadius.full,
    borderWidth: 1.5,
    borderColor: NexusColors.accentCyan,
    backgroundColor: 'rgba(6, 182, 212, 0.04)',
  },
  geofenceMiddle: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: NexusRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.4)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(6, 182, 212, 0.06)',
  },
  geofenceCenter: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: NexusRadius.full,
    backgroundColor: NexusColors.accentEmerald,
    shadowColor: NexusColors.accentEmerald,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  crosshairH: {
    position: 'absolute',
    width: 160,
    height: 1,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
  },
  crosshairV: {
    position: 'absolute',
    width: 1,
    height: 160,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
  },
  coordLabel: {
    position: 'absolute',
    bottom: 0,
    backgroundColor: NexusColors.bgCard,
    borderRadius: NexusRadius.sm,
    paddingHorizontal: NexusSpacing.sm,
    paddingVertical: NexusSpacing.xs,
    borderWidth: 1,
    borderColor: NexusColors.borderGlass,
  },
  coordText: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
    fontWeight: NexusFonts.weights.medium,
  },
  mapLegend: {
    flexDirection: 'row',
    gap: NexusSpacing.lg,
    paddingTop: NexusSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: NexusColors.borderGlass,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: NexusRadius.full,
  },
  legendText: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
  },

  // ── Student list card ─────────────────────────────────────────────────────
  studentListCard: {
    padding: NexusSpacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.sm,
    marginBottom: NexusSpacing.md,
  },
  sectionTitle: {
    flex: 1,
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textSecondary,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
  sectionCount: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.semibold,
    color: NexusColors.accentCyan,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderRadius: NexusRadius.full,
    paddingHorizontal: NexusSpacing.sm,
    paddingVertical: 2,
  },
  emptyText: {
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.textDisabled,
    textAlign: 'center',
    paddingVertical: NexusSpacing.lg,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: NexusSpacing.md,
    gap: NexusSpacing.md,
  },
  studentRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: NexusColors.borderGlass,
  },
  statusBadge: {
    width: 32,
    height: 32,
    borderRadius: NexusRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Dynamic status badge backgrounds
  statusBadge_checked_in: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  statusBadge_pending: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  statusBadge_absent: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
  },
  statusBadge_proxy_risk: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.5)',
  },
  statusIconChecked: {
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.accentEmerald,
    fontWeight: NexusFonts.weights.bold,
  },
  statusIconPending: {
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.accentAmber,
  },
  statusIconAbsent: {
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.accentRose,
    fontWeight: NexusFonts.weights.bold,
  },
  statusIconProxy: {
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.accentAmber,
    fontWeight: NexusFonts.weights.bold,
  },
  studentInfo: {
    flex: 1,
    gap: 2,
  },
  studentName: {
    fontSize: NexusFonts.sizes.base,
    fontWeight: NexusFonts.weights.medium,
    color: NexusColors.textPrimary,
  },
  studentSubId: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
  },
  studentRight: {
    alignItems: 'flex-end',
  },
  checkedInTime: {
    fontSize: NexusFonts.sizes.sm,
    fontWeight: NexusFonts.weights.semibold,
    color: NexusColors.accentEmerald,
  },
  statusLabel_pending: {
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.accentAmber,
    fontWeight: NexusFonts.weights.medium,
  },
  statusLabel_absent: {
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.accentRose,
    fontWeight: NexusFonts.weights.medium,
  },
  statusLabel_proxy_risk: {
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.accentAmber,
    fontWeight: NexusFonts.weights.semibold,
  },

  // ── Proxy alerts section ──────────────────────────────────────────────────
  proxySection: {
    gap: NexusSpacing.md,
  },
});
