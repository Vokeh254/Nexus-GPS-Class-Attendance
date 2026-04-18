import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, Image, Modal, Pressable } from 'react-native';
import { supabase } from '../lib/supabase';
import { useTheme } from '@/hooks/use-theme';
import NexusLoader from '@/components/NexusLoader';
import type { Class, ClassSession, AttendanceLog } from '../types';

interface ClassWithSession {
  class: Class;
  activeSession: ClassSession | null;
  reportResult: {
    summary: string;
    attendanceDetails: Array<{
      studentName: string;
      present: boolean;
      timestamp?: string;
      selfieUrl?: string;
    }>;
  } | null;
}

export default function InstructorDashboard() {
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isInstructor, setIsInstructor] = useState<boolean | null>(null);
  const [classes, setClasses] = useState<ClassWithSession[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedSelfie, setSelectedSelfie] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsInstructor(false); return; }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (!profile || profile.role !== 'instructor') { setIsInstructor(false); return; }
      setIsInstructor(true);

      const { data: classData } = await supabase.from('classes').select('*').eq('instructor_id', user.id);
      if (!classData) return;

      const results: ClassWithSession[] = await Promise.all(
        classData.map(async (cls: Class) => {
          const { data: session } = await supabase
            .from('class_sessions').select('*')
            .eq('class_id', cls.id).eq('is_active', true).maybeSingle();
          return { class: cls, activeSession: session ?? null, reportResult: null };
        })
      );
      setClasses(results);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStartSession = async (cls: Class) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setActionLoading(cls.id + '_start');
    try {
      const { data, error } = await supabase.from('class_sessions').insert({
        class_id: cls.id,
        instructor_id: user.id,
        is_active: true,
        started_at: new Date().toISOString(),
      }).select().single();
      if (!error && data) {
        setClasses((prev) => prev.map((item) =>
          item.class.id === cls.id ? { ...item, activeSession: data as ClassSession, reportResult: null } : item
        ));
      }
    } finally { setActionLoading(null); }
  };

  const handleEndSession = async (cls: Class, session: ClassSession) => {
    setActionLoading(cls.id + '_end');
    try {
      const { error } = await supabase.from('class_sessions')
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq('id', session.id);
      if (!error) {
        setClasses((prev) => prev.map((item) =>
          item.class.id === cls.id ? { ...item, activeSession: null } : item
        ));
      }
    } finally { setActionLoading(null); }
  };

  const handleGenerateReport = async (cls: Class, session: ClassSession) => {
    setActionLoading(cls.id + '_report');
    try {
      // Get attendance logs with student details and selfies
      const { data: logs } = await supabase
        .from('attendance_logs')
        .select(`
          id, signed_at, selfie_url,
          profiles!attendance_logs_student_id_fkey (full_name)
        `)
        .eq('session_id', session.id)
        .eq('verified', true);

      // Get all enrolled students
      const { data: enrolled } = await supabase
        .from('enrollments')
        .select(`
          profiles!enrollments_student_id_fkey (id, full_name)
        `)
        .eq('class_id', cls.id);

      const attendanceMap = new Map(
        (logs || []).map(log => [
          (log.profiles as any)?.full_name,
          {
            present: true,
            timestamp: log.signed_at,
            selfieUrl: log.selfie_url,
          }
        ])
      );

      const attendanceDetails = (enrolled || []).map(enrollment => {
        const studentName = (enrollment.profiles as any)?.full_name || 'Unknown';
        const attendance = attendanceMap.get(studentName);
        return {
          studentName,
          present: !!attendance,
          timestamp: attendance?.timestamp,
          selfieUrl: attendance?.selfieUrl,
        };
      });

      const present = logs?.length ?? 0;
      const total = enrolled?.length ?? 0;
      const rate = total > 0 ? ((present / total) * 100).toFixed(1) : '0.0';
      
      const summary = `Present: ${present}/${total} students\nAttendance Rate: ${rate}%\nGenerated: ${new Date().toLocaleString()}`;
      
      setClasses((prev) => prev.map((item) =>
        item.class.id === cls.id ? { 
          ...item, 
          reportResult: { summary, attendanceDetails }
        } : item
      ));
    } finally { 
      setActionLoading(null); 
    }
  };

  if (loading) return <NexusLoader />;

  if (isInstructor === false) {
    const s = makeStyles(colors, isDark);
    return (
      <View style={s.centered}>
        <Text style={s.accessIcon}>🚫</Text>
        <Text style={s.accessTitle}>Instructors Only</Text>
        <Text style={s.accessSub}>This section is for instructors only.</Text>
      </View>
    );
  }

  const s = makeStyles(colors, isDark);

  return (
    <View style={s.root}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#6C63FF" />}
      >
        <Text style={s.sectionTitle}>INSTRUCTOR DASHBOARD</Text>

        {classes.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>📚</Text>
            <Text style={s.emptyTitle}>No classes assigned</Text>
            <Text style={s.emptySub}>Classes assigned to you will appear here.</Text>
          </View>
        ) : (
          classes.map(({ class: cls, activeSession, reportResult }) => {
            const isStarting = actionLoading === cls.id + '_start';
            const isEnding = actionLoading === cls.id + '_end';
            const isReporting = actionLoading === cls.id + '_report';

            return (
              <View key={cls.id} style={[s.card, activeSession && s.cardActive]}>
                {activeSession && <View style={s.activeLine} />}
                
                <View style={s.cardHeader}>
                  <View style={s.cardTitleWrap}>
                    <Text style={s.className}>{cls.name}</Text>
                    <Text style={s.courseCode}>{cls.course_code}</Text>
                  </View>
                  <View style={[s.badge, activeSession ? s.badgeActive : s.badgeInactive]}>
                    <Text style={[s.badgeText, { color: activeSession ? colors.success : colors.subtext }]}>
                      {activeSession ? '● Live' : 'Inactive'}
                    </Text>
                  </View>
                </View>

                {activeSession && (
                  <Text style={s.sessionTime}>
                    Started {new Date(activeSession.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                )}

                <View style={s.actions}>
                  {!activeSession ? (
                    <TouchableOpacity
                      style={[s.btn, s.btnStart, isStarting && s.btnDisabled]}
                      onPress={() => handleStartSession(cls)}
                      disabled={isStarting}
                      activeOpacity={0.85}
                    >
                      {isStarting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={s.btnText}>▶ Start Session</Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={s.activeActions}>
                      <TouchableOpacity
                        style={[s.btn, s.btnEnd, isEnding && s.btnDisabled]}
                        onPress={() => handleEndSession(cls, activeSession)}
                        disabled={isEnding}
                        activeOpacity={0.85}
                      >
                        {isEnding ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={s.btnText}>⏹ End Session</Text>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[s.btn, s.btnReport, isReporting && s.btnDisabled]}
                        onPress={() => handleGenerateReport(cls, activeSession)}
                        disabled={isReporting}
                        activeOpacity={0.85}
                      >
                        {isReporting ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={s.btnText}>📊 Generate Report</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {reportResult && (
                  <View style={s.reportBox}>
                    <Text style={s.reportText}>{reportResult.summary}</Text>
                    
                    {reportResult.attendanceDetails.length > 0 && (
                      <View style={s.attendanceList}>
                        <Text style={s.attendanceHeader}>Student Details:</Text>
                        {reportResult.attendanceDetails.map((student, index) => (
                          <View key={index} style={s.studentRow}>
                            <View style={s.studentInfo}>
                              <Text style={[s.studentName, { color: student.present ? colors.success : colors.subtext }]}>
                                {student.present ? '✓' : '✗'} {student.studentName}
                              </Text>
                              {student.present && student.timestamp && (
                                <Text style={s.studentTime}>
                                  {new Date(student.timestamp).toLocaleTimeString([], { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}
                                </Text>
                              )}
                            </View>
                            
                            {student.present && student.selfieUrl && cls.selfie_required && (
                              <TouchableOpacity
                                style={s.selfieThumb}
                                onPress={() => setSelectedSelfie(student.selfieUrl!)}
                              >
                                <Image 
                                  source={{ uri: student.selfieUrl }} 
                                  style={s.selfieImage}
                                  resizeMode="cover"
                                />
                              </TouchableOpacity>
                            )}
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Selfie Modal */}
      <Modal
        visible={!!selectedSelfie}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedSelfie(null)}
      >
        <Pressable 
          style={s.modalOverlay}
          onPress={() => setSelectedSelfie(null)}
        >
          <View style={s.modalContent}>
            <Image 
              source={{ uri: selectedSelfie || '' }} 
              style={s.modalImage}
              resizeMode="contain"
            />
            <TouchableOpacity
              style={s.modalCloseButton}
              onPress={() => setSelectedSelfie(null)}
            >
              <Text style={s.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function makeStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1 },
    content: { padding: 20, paddingBottom: 40 },
    
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.bg },
    accessIcon: { fontSize: 48, marginBottom: 12 },
    accessTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 6 },
    accessSub: { fontSize: 14, color: colors.subtext, textAlign: 'center' },

    sectionTitle: { fontSize: 11, fontWeight: '700', color: colors.subtext, letterSpacing: 1.2, marginBottom: 16 },

    emptyState: { alignItems: 'center', marginTop: 60 },
    emptyIcon: { fontSize: 48, marginBottom: 16 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 },
    emptySub: { fontSize: 14, color: colors.subtext, textAlign: 'center' },

    card: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 20,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      overflow: 'hidden',
    },
    cardActive: { borderColor: '#6C63FF', shadowColor: '#6C63FF', shadowOpacity: 0.2, shadowRadius: 10, elevation: 4 },
    activeLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: '#6C63FF' },
    
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    cardTitleWrap: { flex: 1, marginRight: 8 },
    className: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 2 },
    courseCode: { fontSize: 13, color: colors.subtext },
    
    badge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
    badgeActive: { backgroundColor: isDark ? '#0A2A0A' : '#DCFCE7' },
    badgeInactive: { backgroundColor: isDark ? '#1A1A2E' : '#F1F5F9' },
    badgeText: { fontSize: 12, fontWeight: '700' },
    
    sessionTime: { fontSize: 12, color: colors.subtext, marginBottom: 12 },

    actions: { marginTop: 4 },
    activeActions: { gap: 10 },
    btn: { borderRadius: 14, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
    btnStart: { backgroundColor: '#22C55E' },
    btnEnd: { backgroundColor: colors.danger },
    btnReport: { backgroundColor: '#6C63FF' },
    btnDisabled: { opacity: 0.6 },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    reportBox: {
      marginTop: 12,
      backgroundColor: isDark ? '#0A2A0A' : '#F0FDF4',
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: isDark ? '#2A4A2A' : '#BBF7D0',
    },
    reportText: { fontSize: 13, color: isDark ? '#4ADE80' : '#166534', lineHeight: 20, marginBottom: 12 },

    // Attendance details styles
    attendanceList: { marginTop: 8 },
    attendanceHeader: { 
      fontSize: 12, 
      fontWeight: '600', 
      color: isDark ? '#4ADE80' : '#166534', 
      marginBottom: 8 
    },
    studentRow: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      paddingVertical: 4,
      marginBottom: 4,
    },
    studentInfo: { flex: 1 },
    studentName: { fontSize: 12, fontWeight: '500' },
    studentTime: { fontSize: 10, color: colors.subtext, marginTop: 2 },
    
    // Selfie thumbnail styles
    selfieThumb: {
      width: 32,
      height: 32,
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: colors.primary,
    },
    selfieImage: { width: '100%', height: '100%' },

    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.8)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      width: '90%',
      maxWidth: 400,
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 20,
      alignItems: 'center',
    },
    modalImage: {
      width: '100%',
      height: 300,
      borderRadius: 12,
      marginBottom: 16,
    },
    modalCloseButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
    },
    modalCloseText: {
      color: 'white',
      fontWeight: '600',
      fontSize: 14,
    },
  });
}