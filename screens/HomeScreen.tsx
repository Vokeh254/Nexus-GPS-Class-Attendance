import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { ImageBackground, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useTheme } from '@/hooks/use-theme';
import { useRealtimeClock } from '@/hooks/useRealtimeClock';
import NexusLoader from '@/components/NexusLoader';
import CircularProgress from '@/components/CircularProgress';
import { GlassmorphicCard, NexusStatusBar, StreakFlame, HolographicAttendanceCard, LiveMap, CampusPulse, TimeWarpCard, NexusCoinsWallet, GhostModeToggle, EchoVoice, ChronosReplay, NexusNetwork } from '../components/nexus';
import { NexusColors, NexusFonts, NexusSpacing, NexusRadius } from '../constants/theme';
import GeofenceService from '../services/GeofenceService';
import { SessionScheduler } from '../services/SessionScheduler';
import type { Class, ClassSession, Profile, AttendanceLog, Enrollment } from '../types';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface EnrolledClass { 
  class: Class; 
  activeSession: ClassSession | null;
}

interface AttendanceStats {
  totalSessions: number;
  attended: number;
  rate: number;
  recentLogs: (AttendanceLog & { className: string })[];
}

// ── Instructor-specific types ─────────────────────────────────────────────────

interface LiveStudent {
  id: string;
  name: string;
  checkedIn: boolean;
  coords?: { lat: number; lng: number };
}

interface InstructorSessionData {
  session: ClassSession | null;
  checkedInCount: number;
  totalEnrolled: number;
  liveStudents: LiveStudent[];
}

// ── Student-specific helpers ──────────────────────────────────────────────────

/** Count consecutive days ending today (UTC) that have at least 1 verified log */
function computeStreak(logs: AttendanceLog[]): number {
  if (logs.length === 0) return 0;
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);

  // Build a Set of ISO date strings (YYYY-MM-DD) for verified logs
  const verifiedDays = new Set<string>();
  for (const log of logs) {
    if (log.verified) {
      verifiedDays.add(log.signed_at.slice(0, 10));
    }
  }

  let streak = 0;
  const cursor = new Date(todayUtc);
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (!verifiedDays.has(key)) break;
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

type ProximityZone = 'far' | 'approaching' | 'inside';

function zoneColor(zone: ProximityZone): string {
  if (zone === 'inside') return NexusColors.accentEmerald;
  if (zone === 'approaching') return NexusColors.accentAmber;
  return NexusColors.accentRose;
}

function zoneLabel(zone: ProximityZone): string {
  if (zone === 'inside') return 'Inside';
  if (zone === 'approaching') return 'Approaching';
  return 'Far';
}

// ─────────────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const now = useRealtimeClock();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [classes, setClasses] = useState<EnrolledClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null);
  const [stats, setStats] = useState<AttendanceStats>({
    totalSessions: 0,
    attended: 0,
    rate: 0,
    recentLogs: [],
  });

  // ── Student-only state ──────────────────────────────────────────────────────
  const [streakDays, setStreakDays] = useState(0);
  const streakPulse = useRef(new Animated.Value(1)).current;
  const streakGlow = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(streakPulse, { toValue: 1.12, duration: 700, useNativeDriver: true }),
          Animated.timing(streakGlow, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(streakPulse, { toValue: 0.96, duration: 500, useNativeDriver: true }),
          Animated.timing(streakGlow, { toValue: 0.4, duration: 500, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(streakPulse, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(streakGlow, { toValue: 0.6, duration: 300, useNativeDriver: true }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [streakPulse, streakGlow]);
  const [nextSession, setNextSession] = useState<(ClassSession & { className: string; courseCode: string; room?: string }) | null>(null);
  const [todayLogs, setTodayLogs] = useState<AttendanceLog[]>([]);
  const [proximityZone, setProximityZone] = useState<ProximityZone>('far');
  const [gpsState, setGpsState] = useState<'active' | 'searching' | 'disabled'>('searching');
  const [inside, setInside] = useState(false);
  const [accuracyOk, setAccuracyOk] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const proximityIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Phase 2 state
  const [ghostMode, setGhostMode] = useState(false);
  // Phase 3 state
  const [showEcho, setShowEcho]       = useState(false);
  const [showChronos, setShowChronos] = useState(false);
  const [showNetwork, setShowNetwork] = useState(false);
  // Enrollment state
  const [availableClasses, setAvailableClasses] = useState<Class[]>([]);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  // ── Instructor-only state ────────────────────────────────────────────────────
  const [selectedClassIndex, setSelectedClassIndex] = useState(0);
  const [instrSessionData, setInstrSessionData] = useState<InstructorSessionData>({
    session: null,
    checkedInCount: 0,
    totalEnrolled: 0,
    liveStudents: [],
  });
  const instrRealtimeRef = useRef<RealtimeChannel | null>(null);
  // Instructor Phase 3 state
  const [showInstrEcho, setShowInstrEcho]       = useState(false);
  const [showInstrChronos, setShowInstrChronos] = useState(false);
  const [showInstrNetwork, setShowInstrNetwork] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (prof) setProfile(prof);

      // Fetch classes
      let classRows: Class[] = [];
      if (prof?.role === 'instructor') {
        const { data } = await supabase.from('classes').select('*').eq('instructor_id', user.id);
        classRows = data ?? [];
      } else {
        const { data } = await supabase.from('enrollments').select('class_id, classes(*)').eq('student_id', user.id);
        classRows = (data ?? []).map((e: any) => e.classes as Class);

        // Fetch ALL available classes so student can enroll
        const enrolledIds = classRows.map(c => c.id);
        const { data: allClasses } = await supabase
          .from('classes')
          .select('*')
          .order('created_at', { ascending: false });
        // Show only classes the student is NOT yet enrolled in
        setAvailableClasses(
          (allClasses ?? []).filter((c: Class) => !enrolledIds.includes(c.id))
        );
        
        // Fetch attendance stats for students
        if (classRows.length > 0) {
          const classIds = classRows.map(c => c.id);
          
          const { data: sessions } = await supabase
            .from('class_sessions')
            .select('id, class_id')
            .in('class_id', classIds);
          
          const { data: logs } = await supabase
            .from('attendance_logs')
            .select('*, classes(name)')
            .eq('student_id', user.id)
            .in('class_id', classIds)
            .order('signed_at', { ascending: false });
          
          const totalSessions = sessions?.length ?? 0;
          const attended = logs?.length ?? 0;
          const rate = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0;
          
          setStats({
            totalSessions,
            attended,
            rate,
            recentLogs: (logs ?? []).slice(0, 5).map(log => ({
              ...log,
              className: (log.classes as any)?.name ?? 'Unknown Class'
            })),
          });

          // ── Student-specific derived data ─────────────────────────────────
          const allLogs: AttendanceLog[] = (logs ?? []) as AttendanceLog[];
          setStreakDays(computeStreak(allLogs));

          // Today's logs (signed_at >= midnight UTC today)
          const todayStart = new Date();
          todayStart.setUTCHours(0, 0, 0, 0);
          setTodayLogs(allLogs.filter(l => new Date(l.signed_at) >= todayStart));

          // Next upcoming session
          const now = new Date().toISOString();
          const { data: upcomingSessions } = await supabase
            .from('class_sessions')
            .select('*, classes(name, course_code)')
            .in('class_id', classIds)
            .gte('started_at', now)
            .order('started_at', { ascending: true })
            .limit(1);

          if (upcomingSessions && upcomingSessions.length > 0) {
            const s = upcomingSessions[0];
            setNextSession({
              ...s,
              className: (s.classes as any)?.name ?? 'Unknown Class',
              courseCode: (s.classes as any)?.course_code ?? '',
              room: undefined,
            });
            setSessionActive(s.is_active ?? false);
          } else {
            // Check if any active session exists right now
            const { data: activeSessions } = await supabase
              .from('class_sessions')
              .select('*, classes(name, course_code)')
              .in('class_id', classIds)
              .eq('is_active', true)
              .limit(1);
            if (activeSessions && activeSessions.length > 0) {
              const s = activeSessions[0];
              setNextSession({
                ...s,
                className: (s.classes as any)?.name ?? 'Unknown Class',
                courseCode: (s.classes as any)?.course_code ?? '',
                room: undefined,
              });
              setSessionActive(true);
            } else {
              setNextSession(null);
              setSessionActive(false);
            }
          }
        } else {
          // Add placeholder data for presentation when no real data exists
          setStats({
            totalSessions: 25,
            attended: 23,
            rate: 92,
            recentLogs: [
              {
                id: 'demo-1',
                session_id: 'demo-session-1',
                student_id: user.id,
                class_id: 'demo-class-1',
                signed_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                latitude: 0,
                longitude: 0,
                accuracy_m: 15,
                verified: true,
                className: 'Mobile App Development'
              },
              {
                id: 'demo-2',
                session_id: 'demo-session-2',
                student_id: user.id,
                class_id: 'demo-class-2',
                signed_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                latitude: 0,
                longitude: 0,
                accuracy_m: 12,
                verified: true,
                className: 'Advanced Calculus II'
              },
              {
                id: 'demo-3',
                session_id: 'demo-session-3',
                student_id: user.id,
                class_id: 'demo-class-3',
                signed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                latitude: 0,
                longitude: 0,
                accuracy_m: 18,
                verified: true,
                className: 'Data Structures & Algorithms'
              },
              {
                id: 'demo-4',
                session_id: 'demo-session-4',
                student_id: user.id,
                class_id: 'demo-class-4',
                signed_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
                latitude: 0,
                longitude: 0,
                accuracy_m: 20,
                verified: true,
                className: 'Database Management Systems'
              },
              {
                id: 'demo-5',
                session_id: 'demo-session-5',
                student_id: user.id,
                class_id: 'demo-class-5',
                signed_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
                latitude: 0,
                longitude: 0,
                accuracy_m: 14,
                verified: true,
                className: 'Software Engineering'
              }
            ] as any
          });
          // Demo streak and today logs
          setStreakDays(5);
          const todayStart = new Date();
          todayStart.setUTCHours(0, 0, 0, 0);
          setTodayLogs([]);
        }
      }

      const results: EnrolledClass[] = await Promise.all(
        classRows.map(async (cls) => {
          const { data: session } = await supabase
            .from('class_sessions').select('*')
            .eq('class_id', cls.id).eq('is_active', true).maybeSingle();
          return { class: cls, activeSession: session ?? null };
        })
      );

      setClasses(results);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { 
    fetchData();
    return () => {
      SessionScheduler.stop();
    };
  }, [fetchData]);

  // ── Realtime subscription — separate effect, runs once after profile loads ──
  useEffect(() => {
    if (!profile) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      // Re-use profile.id already resolved by fetchData — no extra getUser() call
      const userId = profile.id;

      let classIds: string[] = [];
      if (profile.role === 'instructor') {
        const { data } = await supabase.from('classes').select('id').eq('instructor_id', userId);
        classIds = (data ?? []).map(c => c.id);
        SessionScheduler.start();
      } else {
        const { data } = await supabase.from('enrollments').select('class_id').eq('student_id', userId);
        classIds = (data ?? []).map(e => e.class_id);
      }

      if (classIds.length === 0) return;

      // Unique channel name per user to avoid duplicate subscription errors
      channel = supabase
        .channel(`sessions_${userId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'class_sessions',
          filter: `class_id=in.(${classIds.join(',')})`,
        }, () => fetchData())
        .subscribe();

      setRealtimeChannel(channel);
    };

    setup();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [profile?.id, profile?.role]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  // ── Enroll in a class ─────────────────────────────────────────────────────
  async function enrollInClass(classId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setEnrollingId(classId);
    const { error } = await supabase.from('enrollments').insert({
      student_id: user.id,
      class_id: classId,
    });
    setEnrollingId(null);
    if (error) {
      Alert.alert('Enrollment Failed', error.message);
    } else {
      fetchData(); // refresh to move class from available → enrolled
    }
  }

  // ── Student proximity polling (5-second interval) ─────────────────────────
  useEffect(() => {
    if (!profile || profile.role !== 'student') return;

    const pollProximity = async () => {
      const locationResult = await GeofenceService.getCurrentLocation();
      if (!locationResult.success) {
        setGpsState('disabled');
        setInside(false);
        setAccuracyOk(false);
        setProximityZone('far');
        return;
      }

      setGpsState('active');
      const ok = GeofenceService.isAccuracyAcceptable(locationResult.accuracyMetres);
      setAccuracyOk(ok);

      // Find the active session's class geofence
      const activeClass = classes.find(ec => ec.activeSession?.is_active);
      if (!activeClass) {
        setInside(false);
        setProximityZone('far');
        return;
      }

      const fence = {
        latitude: activeClass.class.geofence_lat,
        longitude: activeClass.class.geofence_lng,
        radius_m: activeClass.class.geofence_radius_m,
      };

      const result = GeofenceService.isWithinGeofence(locationResult.coords, fence);
      if (result.inside) {
        setInside(true);
        setProximityZone('inside');
      } else {
        setInside(false);
        const dist = result.distanceMetres;
        if (dist <= 2 * fence.radius_m) {
          setProximityZone('approaching');
        } else {
          setProximityZone('far');
        }
      }
    };

    // Initial poll
    setGpsState('searching');
    pollProximity();

    proximityIntervalRef.current = setInterval(pollProximity, 5000);
    return () => {
      if (proximityIntervalRef.current) clearInterval(proximityIntervalRef.current);
    };
  }, [profile, classes]);
  // ─────────────────────────────────────────────────────────────────────────

  // ── Instructor: load session data for selected class ──────────────────────
  const loadInstructorSessionData = useCallback(async (cls: EnrolledClass) => {
    const session = cls.activeSession;
    if (!session) {
      setInstrSessionData({ session: null, checkedInCount: 0, totalEnrolled: 0, liveStudents: [] });
      return;
    }

    // Fetch enrolled students
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('student_id, profiles(id, full_name)')
      .eq('class_id', cls.class.id);

    // Fetch attendance logs for this session
    const { data: logs } = await supabase
      .from('attendance_logs')
      .select('student_id, latitude, longitude')
      .eq('session_id', session.id);

    const logSet = new Set((logs ?? []).map((l: any) => l.student_id));
    const logMap = new Map((logs ?? []).map((l: any) => [l.student_id, { lat: l.latitude, lng: l.longitude }]));

    const liveStudents: LiveStudent[] = (enrollments ?? []).map((e: any) => ({
      id: e.student_id,
      name: (e.profiles as any)?.full_name ?? 'Student',
      checkedIn: logSet.has(e.student_id),
      coords: logMap.get(e.student_id),
    }));

    setInstrSessionData({
      session,
      checkedInCount: logSet.size,
      totalEnrolled: liveStudents.length,
      liveStudents,
    });
  }, []);

  // ── Instructor: subscribe to attendance_logs realtime for active session ──
  useEffect(() => {
    if (!profile || profile.role !== 'instructor') return;
    const selectedClass = classes[selectedClassIndex];
    if (!selectedClass) return;

    loadInstructorSessionData(selectedClass);

    const session = selectedClass.activeSession;
    if (!session) return;

    // Clean up previous channel
    if (instrRealtimeRef.current) {
      supabase.removeChannel(instrRealtimeRef.current);
    }

    const channel = supabase
      .channel(`attendance_logs_instr_${session.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_logs',
          filter: `session_id=eq.${session.id}`,
        },
        () => loadInstructorSessionData(selectedClass)
      )
      .subscribe();

    instrRealtimeRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, classes, selectedClassIndex, loadInstructorSessionData]);
  // ─────────────────────────────────────────────────────────────────────────

  if (loading) return <NexusLoader />;

  const isInstructor = profile?.role === 'instructor';
  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';
  const initials = profile?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) ?? '?';
  const avatarUrl = (profile as any)?.avatar_url as string | null | undefined;

  const s = makeStyles(colors, isDark);

  // ── Student View (Nexus Orbit View) ──────────────────────────────────────
  if (!isInstructor) {
    const markAttendanceEnabled = inside && accuracyOk && sessionActive;
    const color = zoneColor(proximityZone);
    const label = zoneLabel(proximityZone);

    return (
      <View style={nx.root}>
        {/* 5.2 — NexusStatusBar */}
        <NexusStatusBar gpsState={gpsState} ntpSynced={true} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={NexusColors.accentCyan}
            />
          }
          contentContainerStyle={nx.scrollContent}
        >
          {/* ── JKUAT Hero with real-time clock ── */}
          <ImageBackground
            source={require('../assets/images/jkuat-campus.jpg')}
            style={nx.heroBg}
            imageStyle={nx.heroBgImage}
          >
            <LinearGradient
              colors={['rgba(11,17,32,0.35)', 'rgba(11,17,32,0.82)']}
              style={nx.heroGradient}
            >
              {/* Top row: greeting + avatar */}
              <View style={nx.heroTopRow}>
                <View>
                  <Text style={nx.heroGreeting}>Hey, {firstName} 👋</Text>
                  <Text style={nx.heroSubGreeting}>JKUAT · Orbit View</Text>
                </View>
                <TouchableOpacity
                  style={nx.avatarCircle}
                  onPress={() => router.push('/(tabs)/profile')}
                >
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={nx.avatarImage} />
                  ) : (
                    <Text style={nx.avatarText}>{initials}</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Streak — floating badge bottom-right of hero */}
              <Animated.View
                style={[
                  nx.heroStreakBadge,
                  {
                    transform: [{ scale: streakPulse }],
                    shadowOpacity: streakGlow,
                  },
                ]}
              >
                <Text style={nx.heroStreakFlame}>🔥</Text>
                <Text style={nx.heroStreakCount}>{streakDays}</Text>
                <Text style={nx.heroStreakLabel}>day streak</Text>
              </Animated.View>

              {/* Clock */}
              <View style={nx.heroClockBlock}>
                <Text style={nx.heroClockTime}>
                  {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </Text>
                <Text style={nx.heroClockDate}>
                  {now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
            </LinearGradient>
          </ImageBackground>

          {/* 5.4 — Next upcoming class session */}
          <GlassmorphicCard style={nx.sectionCard}>
            <Text style={nx.sectionLabel}>NEXT CLASS</Text>
            {nextSession ? (
              <>
                <Text style={nx.nextClassName}>{nextSession.className}</Text>
                <Text style={nx.nextCourseCode}>{nextSession.courseCode}</Text>
                <View style={nx.nextDetailsRow}>
                  <Ionicons name="time-outline" size={14} color={NexusColors.textSecondary} />
                  <Text style={nx.nextDetailText}>
                    {new Date(nextSession.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  {nextSession.room && (
                    <>
                      <Ionicons name="location-outline" size={14} color={NexusColors.textSecondary} />
                      <Text style={nx.nextDetailText}>{nextSession.room}</Text>
                    </>
                  )}
                  {nextSession.is_active && (
                    <View style={nx.liveBadge}>
                      <Text style={nx.liveBadgeText}>LIVE</Text>
                    </View>
                  )}
                </View>
              </>
            ) : (
              <Text style={nx.noSessionText}>No upcoming sessions</Text>
            )}
          </GlassmorphicCard>

          {/* 5.5 — Live geofence proximity indicator */}
          <GlassmorphicCard style={nx.sectionCard} glowColor={color}>
            <Text style={nx.sectionLabel}>GEOFENCE PROXIMITY</Text>
            <View style={nx.proximityRow}>
              <View style={[nx.proximityDot, { backgroundColor: color }]} />
              <Text style={[nx.proximityLabel, { color }]}>{label}</Text>
            </View>
            <View style={nx.proximityZoneRow}>
              {(['far', 'approaching', 'inside'] as ProximityZone[]).map(z => (
                <View key={z} style={nx.zoneItem}>
                  <View style={[nx.zoneDot, { backgroundColor: zoneColor(z), opacity: proximityZone === z ? 1 : 0.3 }]} />
                  <Text style={[nx.zoneText, { color: proximityZone === z ? zoneColor(z) : NexusColors.textDisabled }]}>
                    {zoneLabel(z)}
                  </Text>
                </View>
              ))}
            </View>
          </GlassmorphicCard>

          {/* 5.6 — Mark Attendance quick-action button */}
          <TouchableOpacity
            style={[
              nx.markAttendanceBtn,
              markAttendanceEnabled ? nx.markAttendanceBtnEnabled : nx.markAttendanceBtnDisabled,
            ]}
            disabled={!markAttendanceEnabled}
            onPress={() => router.push('/(tabs)/attendance')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="location"
              size={20}
              color={markAttendanceEnabled ? '#fff' : NexusColors.textDisabled}
            />
            <Text style={[nx.markAttendanceBtnText, !markAttendanceEnabled && nx.markAttendanceBtnTextDisabled]}>
              Mark Attendance
            </Text>
          </TouchableOpacity>

          {/* 5.7 — Today's attendance cards (horizontal scroll) */}
          <Text style={nx.todayLabel}>TODAY'S ATTENDANCE</Text>
          {todayLogs.length === 0 ? (
            <GlassmorphicCard style={nx.emptyTodayCard}>
              <Text style={nx.emptyTodayText}>No attendance records yet today</Text>
            </GlassmorphicCard>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={nx.todayScrollContent}
            >
              {todayLogs.map(log => (
                <View key={log.id} style={nx.todayCardWrapper}>
                  <HolographicAttendanceCard log={log} />
                </View>
              ))}
            </ScrollView>
          )}

          {/* ── Phase 2: TimeWarp prediction ── */}
          {nextSession && (
            <GlassmorphicCard style={nx.sectionCard} glowColor={NexusColors.accentIndigo}>
              <TimeWarpCard
                nextSession={{
                  className: nextSession.className,
                  courseCode: nextSession.courseCode,
                  startedAt: nextSession.started_at,
                  roomDistance: 200,
                }}
                isInsideGeofence={inside}
                sessionActive={sessionActive}
                onMarkAttendance={() => router.push('/(tabs)/attendance')}
              />
            </GlassmorphicCard>
          )}

          {/* ── Phase 2: Campus Pulse ── */}
          <GlassmorphicCard style={nx.sectionCard} glowColor={NexusColors.accentRose}>
            <CampusPulse streakDays={streakDays} />
          </GlassmorphicCard>

          {/* ── Phase 2: Nexus Coins Wallet ── */}
          <GlassmorphicCard style={nx.sectionCard} glowColor={NexusColors.accentAmber}>
            <NexusCoinsWallet streakDays={streakDays} attendanceRate={stats.rate} />
          </GlassmorphicCard>

          {/* ── Phase 2: Ghost Mode ── */}
          <GlassmorphicCard style={nx.sectionCard}>
            <GhostModeToggle enabled={ghostMode} onToggle={setGhostMode} />
          </GlassmorphicCard>

          {/* ── Enrolled Units ── */}
          {classes.length > 0 && (
            <>
              <Text style={nx.sectionLabel}>MY UNITS</Text>
              {classes.map(({ class: cls, activeSession }) => (
                <TouchableOpacity
                  key={cls.id}
                  activeOpacity={0.85}
                  onPress={() => router.push({ pathname: '/student-unit-detail', params: { classId: cls.id } })}
                >
                  <GlassmorphicCard
                    style={nx.enrolledUnitCard}
                    glowColor={activeSession ? NexusColors.accentEmerald : NexusColors.borderGlow}
                  >
                    <View style={nx.enrolledUnitRow}>
                      <View style={nx.enrolledUnitInfo}>
                        <Text style={nx.enrolledUnitName}>{cls.name}</Text>
                        <Text style={nx.enrolledUnitCode}>{cls.course_code}</Text>
                        {cls.scheduled_time ? (
                          <View style={nx.enrolledUnitMeta}>
                            <Ionicons name="time-outline" size={11} color={NexusColors.textSecondary} />
                            <Text style={nx.enrolledUnitMetaText}>{cls.scheduled_time}</Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={nx.enrolledUnitRight}>
                        {activeSession ? (
                          <View style={nx.liveChip}>
                            <View style={nx.liveDot} />
                            <Text style={nx.liveChipText}>LIVE</Text>
                          </View>
                        ) : (
                          <Ionicons name="chevron-forward" size={16} color={NexusColors.textDisabled} />
                        )}
                      </View>
                    </View>
                  </GlassmorphicCard>
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* ── Available Classes to Enroll ── */}
          {availableClasses.length > 0 && (
            <>
              <Text style={nx.sectionLabel}>AVAILABLE CLASSES</Text>
              <GlassmorphicCard style={nx.sectionCard} glowColor={NexusColors.accentIndigo}>
                {availableClasses.map((cls, idx) => (
                  <View
                    key={cls.id}
                    style={[
                      nx.availableRow,
                      idx < availableClasses.length - 1 && nx.availableRowBorder,
                    ]}
                  >
                    <View style={nx.availableInfo}>
                      <Text style={nx.availableName}>{cls.name}</Text>
                      <Text style={nx.availableCode}>{cls.course_code}</Text>
                      {cls.scheduled_time ? (
                        <Text style={nx.availableTime}>{cls.scheduled_time}</Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={[
                        nx.enrollBtn,
                        enrollingId === cls.id && { opacity: 0.6 },
                      ]}
                      onPress={() => enrollInClass(cls.id)}
                      disabled={enrollingId === cls.id}
                      activeOpacity={0.8}
                    >
                      <Text style={nx.enrollBtnText}>
                        {enrollingId === cls.id ? '…' : 'Enroll'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </GlassmorphicCard>
            </>
          )}

          {/* ── Phase 3: Quick-access toolbar ── */}
          <View style={nx.p3Toolbar}>
            {[
              { icon: 'mic-outline'    as const, label: 'Echo',    onPress: () => setShowEcho(true) },
              { icon: 'time-outline'   as const, label: 'Chronos', onPress: () => setShowChronos(true) },
              { icon: 'wifi-outline'   as const, label: 'Network', onPress: () => setShowNetwork(true) },
            ].map((btn) => (
              <TouchableOpacity key={btn.label} style={nx.p3Btn} onPress={btn.onPress} activeOpacity={0.8}>
                <Ionicons name={btn.icon} size={22} color={NexusColors.accentCyan} />
                <Text style={nx.p3BtnLabel}>{btn.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Phase 3 modals */}
        <EchoVoice
          visible={showEcho}
          onClose={() => setShowEcho(false)}
          onNavigateRadar={() => router.push('/(tabs)/attendance')}
          onNavigateAnalytics={() => router.push('/(tabs)/analytics')}
        />
        <ChronosReplay
          visible={showChronos}
          onClose={() => setShowChronos(false)}
          role="student"
        />
        <NexusNetwork
          visible={showNetwork}
          onClose={() => setShowNetwork(false)}
          studentName={profile?.full_name ?? 'Student'}
          isOnline={gpsState !== 'disabled'}
        />
      </View>
    );
  }

  // Instructor View — Command Center (Nexus Design)
  const selectedClass = classes[selectedClassIndex] ?? null;
  const { session, checkedInCount, totalEnrolled, liveStudents } = instrSessionData;
  const attendancePct = totalEnrolled > 0 ? Math.round((checkedInCount / totalEnrolled) * 100) : 0;

  return (
    <View style={cc.root}>
      {/* 9.2 — NexusStatusBar */}
      <NexusStatusBar gpsState="active" ntpSynced={true} />

      {/* ── JKUAT Hero with clock ── */}
      <ImageBackground
        source={require('../assets/images/jkuat-campus.jpg')}
        style={cc.heroBg}
        imageStyle={cc.heroBgImage}
      >
        <LinearGradient
          colors={['rgba(11,17,32,0.3)', 'rgba(11,17,32,0.85)']}
          style={cc.heroGradient}
        >
          <View style={cc.heroTopRow}>
            <View>
              <Text style={cc.heroTitle}>COMMAND CENTER</Text>
              <Text style={cc.heroSub}>Prof. {firstName} · JKUAT</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
              <View style={cc.avatarCircle}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={cc.avatarImage} />
                ) : (
                  <Text style={cc.avatarText}>{initials}</Text>
                )}
              </View>
            </TouchableOpacity>
          </View>
          <View style={cc.heroClockBlock}>
            <Text style={cc.heroClockTime}>
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </Text>
            <Text style={cc.heroClockDate}>
              {now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </Text>
          </View>
        </LinearGradient>
      </ImageBackground>

      {/* 9.6 — Class selector */}
      <View style={cc.selectorRow}>
        <Text style={cc.selectorLabel}>CLASS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={cc.selectorScroll}>
          {classes.length === 0 ? (
            <View style={[cc.selectorChip, cc.selectorChipActive]}>
              <Text style={cc.selectorChipTextActive}>No Classes</Text>
            </View>
          ) : (
            classes.map((ec, idx) => (
              <TouchableOpacity
                key={ec.class.id}
                style={[cc.selectorChip, idx === selectedClassIndex && cc.selectorChipActive]}
                onPress={() => setSelectedClassIndex(idx)}
                activeOpacity={0.8}
              >
                <Text style={[cc.selectorChipText, idx === selectedClassIndex && cc.selectorChipTextActive]}>
                  {ec.class.course_code}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={NexusColors.accentCyan}
          />
        }
        contentContainerStyle={cc.scrollContent}
      >
        {/* Selected class name */}
        {selectedClass && (
          <Text style={cc.className}>{selectedClass.class.name}</Text>
        )}

        {/* Session status badge */}
        <View style={cc.sessionBadgeRow}>
          {session ? (
            <>
              <View style={cc.liveDot} />
              <Text style={cc.liveBadgeText}>LIVE SESSION</Text>
              <Text style={cc.sessionTime}>
                {new Date(session.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </>
          ) : (
            <>
              <View style={[cc.liveDot, { backgroundColor: NexusColors.textDisabled }]} />
              <Text style={[cc.liveBadgeText, { color: NexusColors.textDisabled }]}>NO ACTIVE SESSION</Text>
            </>
          )}
        </View>

        {/* 9.3 — Live attendance monitor */}
        <GlassmorphicCard style={cc.monitorCard} glowColor={NexusColors.accentCyan}>
          <Text style={cc.monitorLabel}>LIVE ATTENDANCE MONITOR</Text>
          <View style={cc.monitorBody}>
            {/* Circular progress */}
            <View style={cc.progressWrapper}>
              <CircularProgress
                percentage={attendancePct}
                size={110}
                strokeWidth={10}
                color={NexusColors.accentCyan}
                backgroundColor={NexusColors.bgCardSolid}
                textColor={NexusColors.textPrimary}
                showPercentage={true}
              />
            </View>
            {/* Count details */}
            <View style={cc.monitorStats}>
              <View style={cc.monitorStatRow}>
                <Text style={cc.monitorStatBig}>{checkedInCount}</Text>
                <Text style={cc.monitorStatSlash}>/{totalEnrolled}</Text>
              </View>
              <Text style={cc.monitorStatLabel}>CHECKED IN</Text>
              <View style={cc.monitorPctBadge}>
                <Text style={cc.monitorPctText}>{attendancePct}%</Text>
              </View>
            </View>
          </View>
        </GlassmorphicCard>

        {/* 9.4 — LiveMap */}
        <GlassmorphicCard style={cc.mapCard} glowColor={NexusColors.borderGlow}>
          <Text style={cc.monitorLabel}>STUDENT MAP</Text>
          <LiveMap students={liveStudents} />
        </GlassmorphicCard>

        {/* 9.5 — Quick actions */}
        <Text style={cc.actionsLabel}>QUICK ACTIONS</Text>
        <View style={cc.actionsGrid}>
          <TouchableOpacity
            style={[cc.actionBtn, { borderColor: NexusColors.accentCyan }]}
            onPress={() => router.push('/(tabs)/units')}
            activeOpacity={0.8}
          >
            <Ionicons name="book-outline" size={22} color={NexusColors.accentCyan} />
            <Text style={[cc.actionBtnText, { color: NexusColors.accentCyan }]}>Manage Units</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[cc.actionBtn, { borderColor: NexusColors.accentRose }]}
            onPress={async () => {
              if (!session) { Alert.alert('No active session'); return; }
              const now = new Date().toISOString();
              await supabase.from('class_sessions')
                .update({ is_active: false, ended_at: now })
                .eq('id', session.id);
              fetchData();
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="lock-closed-outline" size={22} color={NexusColors.accentRose} />
            <Text style={[cc.actionBtnText, { color: NexusColors.accentRose }]}>Close Session</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[cc.actionBtn, { borderColor: NexusColors.accentIndigo }]}
            onPress={() => Alert.alert('Send Alert', 'Alert broadcast coming soon!')}
            activeOpacity={0.8}
          >
            <Ionicons name="megaphone-outline" size={22} color={NexusColors.accentIndigo} />
            <Text style={[cc.actionBtnText, { color: NexusColors.accentIndigo }]}>Send Alert</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[cc.actionBtn, { borderColor: NexusColors.accentAmber }]}
            onPress={() => router.push('/(tabs)/attendance')}
            activeOpacity={0.8}
          >
            <Ionicons name="eye-outline" size={22} color={NexusColors.accentAmber} />
            <Text style={[cc.actionBtnText, { color: NexusColors.accentAmber }]}>View Details</Text>
          </TouchableOpacity>
        </View>

        {/* ── My Units inline section ── */}
        <Text style={cc.actionsLabel}>MY UNITS</Text>
        <GlassmorphicCard style={cc.unitsCard} glowColor={NexusColors.accentIndigo}>
          {classes.length === 0 ? (
            <Text style={cc.unitsEmptyText}>No units assigned yet.</Text>
          ) : (
            classes.map((ec, idx) => {
              const isLive = ec.activeSession?.is_active === true;
              return (
                <TouchableOpacity
                  key={ec.class.id}
                  style={[cc.unitRow, idx < classes.length - 1 && cc.unitRowBorder]}
                  onPress={() => router.push({ pathname: '/unit-detail', params: { classId: ec.class.id } })}
                  activeOpacity={0.8}
                >
                  <View style={cc.unitInfo}>
                    <Text style={cc.unitName}>{ec.class.name}</Text>
                    <Text style={cc.unitCode}>{ec.class.course_code}</Text>
                    {ec.class.scheduled_time ? (
                      <Text style={cc.unitTime}>{ec.class.scheduled_time}</Text>
                    ) : null}
                  </View>
                  <View style={[cc.unitStatusPill, { borderColor: isLive ? NexusColors.accentEmerald : NexusColors.textDisabled }]}>
                    <Text style={[cc.unitStatusText, { color: isLive ? NexusColors.accentEmerald : NexusColors.textDisabled }]}>
                      {isLive ? '● LIVE' : '— IDLE'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          <TouchableOpacity
            style={cc.unitsManageBtn}
            onPress={() => router.push('/(tabs)/units')}
            activeOpacity={0.8}
          >
            <Ionicons name="settings-outline" size={14} color={NexusColors.accentIndigo} />
            <Text style={cc.unitsManageBtnText}>Manage Units & Coordinates</Text>
          </TouchableOpacity>
        </GlassmorphicCard>
      </ScrollView>

      {/* ── Phase 3: Instructor toolbar ── */}
      <View style={cc.p3Toolbar}>
        {[
          { icon: 'mic-outline'  as const, label: 'Echo',    onPress: () => setShowInstrEcho(true) },
          { icon: 'time-outline' as const, label: 'Chronos', onPress: () => setShowInstrChronos(true) },
          { icon: 'wifi-outline' as const, label: 'Network', onPress: () => setShowInstrNetwork(true) },
        ].map((btn) => (
          <TouchableOpacity key={btn.label} style={cc.p3Btn} onPress={btn.onPress} activeOpacity={0.8}>
            <Ionicons name={btn.icon} size={22} color={NexusColors.accentIndigo} />
            <Text style={cc.p3BtnLabel}>{btn.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <EchoVoice visible={showInstrEcho} onClose={() => setShowInstrEcho(false)} />
      <ChronosReplay visible={showInstrChronos} onClose={() => setShowInstrChronos(false)} role="instructor" sessionName={selectedClass?.class.name ?? 'Session'} />
      <NexusNetwork visible={showInstrNetwork} onClose={() => setShowInstrNetwork(false)} isOnline />
    </View>
  );
}

// ── Nexus student styles (static — no theme dependency) ──────────────────────
const nx = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: NexusColors.bgPrimary,
  },
  scrollContent: {
    paddingHorizontal: NexusSpacing['2xl'],
    paddingTop: 0,
    paddingBottom: NexusSpacing['3xl'],
    gap: NexusSpacing.lg,
  },
  // Hero
  heroBg: {
    width: '100%',
    height: 210,
  },
  heroBgImage: {
    resizeMode: 'cover',
  },
  heroGradient: {
    flex: 1,
    paddingHorizontal: NexusSpacing['2xl'],
    paddingTop: NexusSpacing.xl,
    paddingBottom: NexusSpacing.xl,
    justifyContent: 'space-between',
    position: 'relative',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroGreeting: {
    fontSize: NexusFonts.sizes.xl,
    fontWeight: NexusFonts.weights.bold,
    color: '#fff',
  },
  heroSubGreeting: {
    fontSize: NexusFonts.sizes.xs,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
    letterSpacing: 1,
  },
  // Streak floating badge — absolute bottom-right of hero
  heroStreakBadge: {
    position: 'absolute',
    bottom: NexusSpacing.xl,
    right: NexusSpacing['2xl'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.55)',
    borderRadius: NexusRadius.full,
    paddingHorizontal: NexusSpacing.md,
    paddingVertical: 5,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    elevation: 6,
  },
  heroStreakFlame: {
    fontSize: 16,
  },
  heroStreakCount: {
    fontSize: NexusFonts.sizes.base,
    fontWeight: NexusFonts.weights.bold,
    color: '#F59E0B',
  },
  heroStreakLabel: {
    fontSize: NexusFonts.sizes.xs,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: NexusFonts.weights.medium,
  },
  heroClockBlock: {
    alignItems: 'flex-start',
  },
  heroClockTime: {
    fontSize: 30,
    fontWeight: '900',
    color: NexusColors.accentCyan,
    letterSpacing: 1,
  },
  heroClockDate: {
    fontSize: NexusFonts.sizes.xs,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: NexusSpacing.lg,
  },
  greeting: {
    fontSize: NexusFonts.sizes.xl,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textPrimary,
  },
  subGreeting: {
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.accentCyan,
    fontWeight: NexusFonts.weights.medium,
    letterSpacing: NexusFonts.letterSpacing.widest,
    marginTop: 2,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: NexusRadius.full,
    backgroundColor: NexusColors.accentCyan,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: NexusRadius.full,
  },
  avatarText: {
    color: NexusColors.bgPrimary,
    fontSize: NexusFonts.sizes.sm,
    fontWeight: NexusFonts.weights.bold,
  },
  streakCard: {
    marginBottom: NexusSpacing.lg,
    padding: NexusSpacing.lg,
  },
  sectionCard: {
    marginBottom: NexusSpacing.lg,
    padding: NexusSpacing.lg,
  },
  sectionLabel: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textSecondary,
    letterSpacing: NexusFonts.letterSpacing.widest,
    marginBottom: NexusSpacing.sm,
  },
  nextClassName: {
    fontSize: NexusFonts.sizes.lg,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textPrimary,
    marginBottom: NexusSpacing.xs,
  },
  nextCourseCode: {
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.accentCyan,
    fontWeight: NexusFonts.weights.semibold,
    marginBottom: NexusSpacing.sm,
  },
  nextDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.xs,
    flexWrap: 'wrap',
  },
  nextDetailText: {
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.textSecondary,
  },
  liveBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: NexusColors.accentEmerald,
    borderRadius: NexusRadius.sm,
    paddingHorizontal: NexusSpacing.sm,
    paddingVertical: 2,
  },
  liveBadgeText: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.accentEmerald,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
  noSessionText: {
    fontSize: NexusFonts.sizes.base,
    color: NexusColors.textSecondary,
    fontStyle: 'italic',
  },
  proximityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.sm,
    marginBottom: NexusSpacing.md,
  },
  proximityDot: {
    width: 14,
    height: 14,
    borderRadius: NexusRadius.full,
  },
  proximityLabel: {
    fontSize: NexusFonts.sizes.lg,
    fontWeight: NexusFonts.weights.bold,
  },
  proximityZoneRow: {
    flexDirection: 'row',
    gap: NexusSpacing.xl,
  },
  zoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.xs,
  },
  zoneDot: {
    width: 8,
    height: 8,
    borderRadius: NexusRadius.full,
  },
  zoneText: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.medium,
  },
  markAttendanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: NexusSpacing.sm,
    paddingVertical: NexusSpacing.lg,
    borderRadius: NexusRadius.lg,
    marginBottom: NexusSpacing['2xl'],
  },
  markAttendanceBtnEnabled: {
    backgroundColor: NexusColors.accentCyan,
    shadowColor: NexusColors.accentCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  markAttendanceBtnDisabled: {
    backgroundColor: NexusColors.bgCardSolid,
    borderWidth: 1,
    borderColor: NexusColors.borderGlass,
  },
  markAttendanceBtnText: {
    fontSize: NexusFonts.sizes.md,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.bgPrimary,
  },
  markAttendanceBtnTextDisabled: {
    color: NexusColors.textDisabled,
  },
  todayLabel: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textSecondary,
    letterSpacing: NexusFonts.letterSpacing.widest,
    marginBottom: NexusSpacing.md,
  },
  todayScrollContent: {
    gap: NexusSpacing.md,
    paddingRight: NexusSpacing.xl,
  },
  todayCardWrapper: {
    width: 260,
  },
  emptyTodayCard: {
    padding: NexusSpacing.xl,
    alignItems: 'center',
  },
  emptyTodayText: {
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.textSecondary,
    fontStyle: 'italic',
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
    marginBottom: NexusSpacing['2xl'],
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
  // Available classes enrollment
  availableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: NexusSpacing.md,
    gap: NexusSpacing.md,
  },
  availableRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: NexusColors.borderGlass,
  },
  availableInfo: { flex: 1 },
  availableName: {
    fontSize: NexusFonts.sizes.sm,
    fontWeight: NexusFonts.weights.semibold,
    color: NexusColors.textPrimary,
  },
  availableCode: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.accentCyan,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  availableTime: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
    marginTop: 2,
  },
  enrollBtn: {
    backgroundColor: NexusColors.accentIndigo,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  enrollBtnText: {
    color: '#fff',
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.bold,
  },
  // Enrolled unit cards
  enrolledUnitCard: {
    padding: NexusSpacing.md,
    marginBottom: NexusSpacing.sm,
  },
  enrolledUnitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  enrolledUnitInfo: { flex: 1, marginRight: NexusSpacing.sm },
  enrolledUnitName: {
    fontSize: NexusFonts.sizes.base,
    fontWeight: NexusFonts.weights.semibold,
    color: NexusColors.textPrimary,
  },
  enrolledUnitCode: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.accentCyan,
    marginTop: 2,
    letterSpacing: 0.8,
  },
  enrolledUnitMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  enrolledUnitMetaText: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
  },
  enrolledUnitRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderWidth: 1,
    borderColor: NexusColors.accentEmerald,
    borderRadius: NexusRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: NexusColors.accentEmerald,
  },
  liveChipText: {
    fontSize: 10,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.accentEmerald,
    letterSpacing: 1,
  },
});

// ── Nexus instructor (Command Center) styles ─────────────────────────────────
const cc = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: NexusColors.bgPrimary,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: NexusSpacing['2xl'],
    paddingTop: NexusSpacing.xl,
    paddingBottom: NexusSpacing.lg,
  },
  // Hero
  heroBg: {
    width: '100%',
    height: 210,
  },
  heroBgImage: {
    resizeMode: 'cover',
  },
  heroGradient: {
    flex: 1,
    paddingHorizontal: NexusSpacing['2xl'],
    paddingTop: NexusSpacing.xl,
    paddingBottom: NexusSpacing.xl,
    justifyContent: 'space-between',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroTitle: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.accentCyan,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
  heroSub: {
    fontSize: NexusFonts.sizes.lg,
    fontWeight: NexusFonts.weights.bold,
    color: '#fff',
    marginTop: 2,
  },
  heroClockBlock: {
    alignItems: 'flex-start',
  },
  heroClockTime: {
    fontSize: 30,
    fontWeight: '900',
    color: NexusColors.accentCyan,
    letterSpacing: 1,
  },
  heroClockDate: {
    fontSize: NexusFonts.sizes.xs,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  headerTitle: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.accentCyan,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
  headerSub: {
    fontSize: NexusFonts.sizes.lg,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textPrimary,
    marginTop: 2,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: NexusRadius.full,
    backgroundColor: NexusColors.accentCyan,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: NexusRadius.full,
  },
  avatarText: {
    color: NexusColors.bgPrimary,
    fontSize: NexusFonts.sizes.sm,
    fontWeight: NexusFonts.weights.bold,
  },
  // Class selector
  selectorRow: {
    paddingHorizontal: NexusSpacing['2xl'],
    paddingBottom: NexusSpacing.lg,
  },
  selectorLabel: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textSecondary,
    letterSpacing: NexusFonts.letterSpacing.widest,
    marginBottom: NexusSpacing.sm,
  },
  selectorScroll: {
    gap: NexusSpacing.sm,
  },
  selectorChip: {
    paddingHorizontal: NexusSpacing.lg,
    paddingVertical: NexusSpacing.sm,
    borderRadius: NexusRadius.full,
    borderWidth: 1,
    borderColor: NexusColors.borderGlass,
    backgroundColor: NexusColors.bgCard,
  },
  selectorChipActive: {
    borderColor: NexusColors.accentCyan,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
  },
  selectorChipText: {
    fontSize: NexusFonts.sizes.sm,
    fontWeight: NexusFonts.weights.semibold,
    color: NexusColors.textSecondary,
  },
  selectorChipTextActive: {
    color: NexusColors.accentCyan,
  },
  // Scroll content
  scrollContent: {
    paddingHorizontal: NexusSpacing['2xl'],
    paddingTop: NexusSpacing.lg,
    paddingBottom: NexusSpacing['3xl'],
    gap: NexusSpacing.lg,
  },
  className: {
    fontSize: NexusFonts.sizes['2xl'],
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textPrimary,
    marginBottom: NexusSpacing.sm,
  },
  sessionBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.sm,
    marginBottom: NexusSpacing.lg,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: NexusRadius.full,
    backgroundColor: NexusColors.accentRose,
  },
  liveBadgeText: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.accentRose,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
  sessionTime: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
    marginLeft: NexusSpacing.xs,
  },
  // Monitor card
  monitorCard: {
    padding: NexusSpacing.lg,
    marginBottom: NexusSpacing.lg,
  },
  monitorLabel: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textSecondary,
    letterSpacing: NexusFonts.letterSpacing.widest,
    marginBottom: NexusSpacing.lg,
  },
  monitorBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing['2xl'],
  },
  progressWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  monitorStats: {
    flex: 1,
    gap: NexusSpacing.sm,
  },
  monitorStatRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: NexusSpacing.xs,
  },
  monitorStatBig: {
    fontSize: NexusFonts.sizes['4xl'],
    fontWeight: NexusFonts.weights.black,
    color: NexusColors.textPrimary,
  },
  monitorStatSlash: {
    fontSize: NexusFonts.sizes.xl,
    fontWeight: NexusFonts.weights.semibold,
    color: NexusColors.textSecondary,
  },
  monitorStatLabel: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textSecondary,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
  monitorPctBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderWidth: 1,
    borderColor: NexusColors.accentCyan,
    borderRadius: NexusRadius.sm,
    paddingHorizontal: NexusSpacing.sm,
    paddingVertical: 2,
  },
  monitorPctText: {
    fontSize: NexusFonts.sizes.sm,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.accentCyan,
  },
  // Map card
  mapCard: {
    padding: NexusSpacing.lg,
    marginBottom: NexusSpacing.lg,
  },
  // Quick actions
  actionsLabel: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textSecondary,
    letterSpacing: NexusFonts.letterSpacing.widest,
    marginBottom: NexusSpacing.md,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: NexusSpacing.lg,
  },
  actionBtn: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.sm,
    backgroundColor: NexusColors.bgCard,
    borderWidth: 1,
    borderRadius: NexusRadius.lg,
    paddingVertical: NexusSpacing.xl,
    paddingHorizontal: NexusSpacing.lg,
  },
  actionBtnText: {
    fontSize: NexusFonts.sizes.sm,
    fontWeight: NexusFonts.weights.semibold,
  },
  // Phase 3 toolbar
  p3Toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: NexusColors.bgCardSolid,
    borderTopWidth: 1,
    borderTopColor: NexusColors.borderGlass,
    paddingVertical: NexusSpacing.lg,
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

  // ── My Units inline card ──────────────────────────────────────────────────
  unitsCard: { paddingHorizontal: NexusSpacing.lg, paddingBottom: NexusSpacing.sm },
  unitsEmptyText: {
    color: NexusColors.textSecondary,
    fontSize: NexusFonts.sizes.sm,
    paddingVertical: NexusSpacing.lg,
    textAlign: 'center',
  },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: NexusSpacing.md,
    gap: NexusSpacing.md,
  },
  unitRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: NexusColors.borderGlass,
  },
  unitInfo: { flex: 1 },
  unitName: {
    fontSize: NexusFonts.sizes.sm,
    fontWeight: NexusFonts.weights.semibold,
    color: NexusColors.textPrimary,
  },
  unitCode: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.accentCyan,
    marginTop: 1,
    letterSpacing: 0.5,
  },
  unitTime: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
    marginTop: 1,
  },
  unitStatusPill: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  unitStatusText: {
    fontSize: 10,
    fontWeight: NexusFonts.weights.bold,
    letterSpacing: 0.5,
  },
  unitsManageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: NexusSpacing.sm,
    paddingVertical: NexusSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: NexusColors.borderGlass,
  },
  unitsManageBtnText: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.accentIndigo,
    fontWeight: NexusFonts.weights.semibold,
  },
});

function makeStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    
    header: {
      backgroundColor: colors.card,
      paddingTop: 50,
      paddingHorizontal: 20,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    subtitle: {
      fontSize: 12,
      color: colors.subtext,
      marginBottom: 8,
    },
    greeting: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 8,
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

    content: {
      padding: 20,
    },

    section: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 20,
      marginBottom: 16,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.primary,
    },
    currentBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#2A2A3E' : '#F0EEFF',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      gap: 4,
    },
    currentText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },

    progressContainer: {
      alignItems: 'center',
      marginVertical: 24,
    },

    statsLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    statBox: {
      flex: 1,
      backgroundColor: isDark ? '#2A2A3E' : '#F0EEFF',
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    statNumber: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      color: colors.subtext,
    },

    percentageCard: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginBottom: 20,
    },
    percentageText: {
      fontSize: 28,
      fontWeight: 'bold',
      color: 'white',
    },

    activitySection: {
      marginTop: 8,
    },
    activityHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    activityTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    viewAllText: {
      fontSize: 12,
      color: colors.primary,
    },
    activityItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
      gap: 12,
    },
    activityIcon: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: isDark ? '#2A2A3E' : '#F0EEFF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    activityContent: {
      flex: 1,
    },
    activityClass: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    activityTime: {
      fontSize: 12,
      color: colors.subtext,
    },
    activityBadge: {
      backgroundColor: isDark ? '#0A2A0A' : '#DCFCE7',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    activityBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.success,
    },
    emptyActivity: {
      alignItems: 'center',
      paddingVertical: 32,
    },
    emptyText: {
      fontSize: 14,
      color: colors.subtext,
      marginTop: 8,
    },

    // Exam Predictions Section
    examSection: {
      marginTop: 20,
      paddingTop: 20,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
    },
    examHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    examTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    examCards: {
      flexDirection: 'row',
      gap: 12,
    },
    examCard: {
      flex: 1,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    examCardTitle: {
      fontSize: 12,
      fontWeight: '500',
      marginTop: 8,
      marginBottom: 4,
    },
    examCardValue: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    examCardSubtext: {
      fontSize: 10,
      textAlign: 'center',
    },

    // Live Sessions Section
    liveSessionsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    liveDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.success + '30',
      alignItems: 'center',
      justifyContent: 'center',
    },
    liveDotInner: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.success,
    },
    liveSessionCard: {
      borderRadius: 16,
      padding: 20,
      borderWidth: 2,
      marginBottom: 12,
    },
    liveSessionHeader: {
      marginBottom: 12,
    },
    liveSessionBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.success + '20',
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      gap: 6,
    },
    liveSessionDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.success,
    },
    liveSessionBadgeText: {
      fontSize: 10,
      fontWeight: 'bold',
      color: colors.success,
      letterSpacing: 0.5,
    },
    liveSessionClass: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    liveSessionCode: {
      fontSize: 14,
      marginBottom: 4,
    },
    liveSessionTime: {
      fontSize: 12,
      marginBottom: 8,
    },
    liveSessionDescription: {
      fontSize: 13,
      marginBottom: 16,
      lineHeight: 18,
    },
    liveSessionActions: {
      flexDirection: 'row',
      gap: 12,
    },
    liveSessionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 12,
      gap: 8,
    },
    checkInBtn: {
      backgroundColor: colors.success,
    },
    checkOutBtn: {
      backgroundColor: colors.danger,
    },
    liveSessionBtnText: {
      color: 'white',
      fontSize: 14,
      fontWeight: '600',
    },

    activeSessionBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.success + '20',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      gap: 6,
      marginTop: 8,
      alignSelf: 'flex-start',
    },
    activeSessionText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.success,
    },

    emptyState: {
      alignItems: 'center',
      paddingVertical: 60,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.subtext,
      textAlign: 'center',
    },

    // ── Instructor Dashboard ──────────────────────────────────────────
    instrHeader: {
      backgroundColor: colors.card,
      paddingTop: 52,
      paddingHorizontal: 20,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    instrHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    instrLogoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    instrLogoCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    instrLogoText: {
      color: 'white',
      fontSize: 16,
      fontWeight: 'bold',
    },
    instrAppName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    instrDate: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.subtext,
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    instrGreeting: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text,
      lineHeight: 34,
      marginBottom: 6,
    },
    instrSubGreeting: {
      fontSize: 14,
      color: colors.subtext,
      marginBottom: 12,
    },
    instrWeatherBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1E2A3E' : '#EEF2FF',
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      gap: 6,
    },
    instrWeatherText: {
      fontSize: 12,
      color: colors.text,
      fontWeight: '500',
    },

    instrContent: {
      padding: 20,
    },

    instrLiveCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 20,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    instrLiveBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 10,
    },
    instrLiveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#EF4444',
    },
    instrLiveBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#EF4444',
      letterSpacing: 0.8,
    },
    instrLiveTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      lineHeight: 30,
      marginBottom: 4,
    },
    instrLiveRoom: {
      fontSize: 13,
      color: colors.subtext,
      marginBottom: 16,
    },
    instrAttendanceRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      marginBottom: 8,
    },
    instrAttendanceBig: {
      fontSize: 36,
      fontWeight: 'bold',
      color: colors.primary,
    },
    instrAttendanceSlash: {
      fontSize: 22,
      fontWeight: '600',
      color: colors.subtext,
    },
    instrAttendanceLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.subtext,
      letterSpacing: 0.5,
    },
    instrProgressBg: {
      height: 8,
      backgroundColor: isDark ? '#2A2A3E' : '#E8EAF0',
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 20,
    },
    instrProgressFill: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    instrMapBox: {
      height: 160,
      backgroundColor: isDark ? '#1A2A1A' : '#D1FAE5',
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
      overflow: 'hidden',
    },
    instrMapInner: {
      width: 80,
      height: 80,
      borderRadius: 12,
      backgroundColor: isDark ? '#2A3A2A' : '#A7F3D0',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.primary,
    },
    instrMapPin: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    instrGeofenceLabel: {
      position: 'absolute',
      bottom: 10,
      right: 12,
      fontSize: 9,
      fontWeight: '700',
      color: colors.success,
      letterSpacing: 1,
    },
    instrBtnPrimary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: 14,
      gap: 8,
      marginBottom: 12,
    },
    instrBtnPrimaryText: {
      color: 'white',
      fontSize: 15,
      fontWeight: '700',
    },
    instrBtnSecondary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#1E2A3E' : '#EEF2FF',
      paddingVertical: 16,
      borderRadius: 14,
      gap: 8,
      marginBottom: 12,
    },
    instrBtnSecondaryText: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: '600',
    },

    instrSectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.subtext,
      letterSpacing: 1.2,
      marginBottom: 12,
    },
    instrInsightRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 12,
    },
    instrInsightCard: {
      flex: 1,
      borderRadius: 14,
      padding: 16,
      alignItems: 'flex-start',
      gap: 4,
    },
    instrInsightValue: {
      fontSize: 26,
      fontWeight: 'bold',
      marginTop: 4,
    },
    instrInsightLabel: {
      fontSize: 11,
    },
    instrViewAnalyticsBtn: {
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      marginBottom: 4,
    },
    instrViewAnalyticsText: {
      fontSize: 14,
      fontWeight: '600',
    },

    instrUpcomingCard: {
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    instrUpcomingTimeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    instrUpcomingTimeBadge: {
      backgroundColor: isDark ? '#1E2A3E' : '#EEF2FF',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    instrUpcomingTimeBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primary,
    },
    instrUpcomingRoom: {
      fontSize: 12,
    },
    instrUpcomingName: {
      fontSize: 15,
      fontWeight: '600',
    },
  });
}
