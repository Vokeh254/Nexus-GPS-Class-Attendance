import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert, Animated, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useLocalSearchParams } from 'expo-router'
import * as LocalAuthentication from 'expo-local-authentication'
import { supabase } from '@/lib/supabase'
import { NexusColors, NexusFonts, NexusSpacing, NexusRadius } from '@/constants/theme'
import { GlassmorphicCard } from '@/components/nexus/GlassmorphicCard'
import { NexusStatusBar } from '@/components/nexus/NexusStatusBar'
import NexusLoader from '@/components/NexusLoader'
import GeofenceService from '@/services/GeofenceService'
import NotificationService from '@/services/NotificationService'
import type { Class, ClassSession, AttendanceLog, ClassMessage } from '@/types'

function minutesUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / 60000)
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function StudentUnitDetailScreen() {
  const { classId } = useLocalSearchParams<{ classId: string }>()
  const [cls, setCls]               = useState<Class | null>(null)
  const [sessions, setSessions]     = useState<ClassSession[]>([])
  const [activeSession, setActive]  = useState<ClassSession | null>(null)
  const [logs, setLogs]             = useState<AttendanceLog[]>([])
  const [message, setMessage]       = useState<ClassMessage | null>(null)
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [reminders, setReminders]   = useState<Record<string, { id15: string|null; id10: string|null }>>({})
  const [marking, setMarking]       = useState(false)
  const [marked, setMarked]         = useState(false)

  const pulse = useRef(new Animated.Value(1)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [pulse])

  const fetchData = useCallback(async () => {
    if (!classId) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: classData }, { data: sessionData }, { data: logData }, { data: msgData }] =
      await Promise.all([
        supabase.from('classes').select('*').eq('id', classId).single(),
        supabase.from('class_sessions').select('*').eq('class_id', classId).order('scheduled_start', { ascending: true }),
        supabase.from('attendance_logs').select('*').eq('class_id', classId).eq('student_id', user.id).order('signed_at', { ascending: false }),
        supabase.from('class_messages').select('*').eq('class_id', classId).order('created_at', { ascending: false }).limit(1),
      ])
    if (classData) setCls(classData)
    if (sessionData) {
      setSessions(sessionData)
      const active = sessionData.find((s: ClassSession) => s.is_active) ?? null
      setActive(active)
      if (active && logData) setMarked(logData.some((l: AttendanceLog) => l.session_id === active.id))
    }
    if (logData) setLogs(logData)
    if (msgData && msgData.length > 0) setMessage(msgData[0])
    setLoading(false)
    setRefreshing(false)
  }, [classId])

  useEffect(() => { fetchData() }, [fetchData])

  async function toggleReminder(session: ClassSession) {
    if (!cls || !session.scheduled_start) return
    const existing = reminders[session.id]
    if (existing) {
      await NotificationService.cancelReminders([existing.id15, existing.id10])
      setReminders(prev => { const n = { ...prev }; delete n[session.id]; return n })
      Alert.alert('Reminder Cancelled', 'Reminders for this session removed.')
      return
    }
    const result = await NotificationService.scheduleClassReminders({
      classId: cls.id, sessionId: session.id,
      className: cls.name, courseCode: cls.course_code,
      scheduledAt: new Date(session.scheduled_start),
    })
    if (!result.id15min && !result.id10min) {
      Alert.alert('Permission Required', 'Enable notifications in Settings to set reminders.')
      return
    }
    setReminders(prev => ({ ...prev, [session.id]: { id15: result.id15min, id10: result.id10min } }))
    Alert.alert('Reminder Set', `You will be notified 15 min and 10 min before ${cls.course_code}.\n\nMark within 15 min of start to earn Nexus Coins!`)
  }

  async function markAttendance() {
    if (!cls || !activeSession) return
    setMarking(true)
    try {
      const hasBio = await LocalAuthentication.hasHardwareAsync()
      const enrolled = await LocalAuthentication.isEnrolledAsync()
      if (hasBio && enrolled) {
        const bio = await LocalAuthentication.authenticateAsync({
          promptMessage: `Verify identity for ${cls.course_code}`,
          fallbackLabel: 'Use PIN',
        })
        if (!bio.success) {
          Alert.alert('Authentication Failed', 'Biometric verification is required.')
          setMarking(false); return
        }
      }
      const loc = await GeofenceService.getCurrentLocation()
      if (!loc.success) {
        Alert.alert('GPS Error', 'Could not get your location. Move to an open area.')
        setMarking(false); return
      }
      if (!GeofenceService.isAccuracyAcceptable(loc.accuracyMetres)) {
        Alert.alert('Weak GPS', `Accuracy is ${Math.round(loc.accuracyMetres)}m. Move near a window.`)
        setMarking(false); return
      }
      if (!cls.allow_outside_geofence && cls.geofence_lat !== 0) {
        const fence = { latitude: cls.geofence_lat, longitude: cls.geofence_lng, radius_m: cls.geofence_radius_m }
        const check = GeofenceService.isWithinGeofence(loc.coords, fence)
        if (!check.inside) {
          const dist = Math.round((check as any).distanceMetres ?? 0)
          Alert.alert('Outside Classroom', `You are ${dist}m away. Must be within ${cls.geofence_radius_m}m.`)
          setMarking(false); return
        }
      }
      const { data: { user } } = await supabase.auth.getUser()
      const { data: existing } = await supabase.from('attendance_logs').select('id')
        .eq('session_id', activeSession.id).eq('student_id', user!.id).maybeSingle()
      if (existing) {
        setMarked(true)
        Alert.alert('Already Signed', 'You have already marked attendance for this session.')
        setMarking(false); return
      }
      const { error } = await supabase.from('attendance_logs').insert({
        session_id: activeSession.id, student_id: user!.id, class_id: cls.id,
        signed_at: new Date().toISOString(),
        latitude: loc.coords.latitude, longitude: loc.coords.longitude,
        accuracy_m: loc.accuracyMetres, verified: true,
      })
      if (error) {
        Alert.alert('Error', 'Could not record attendance. Please try again.')
        setMarking(false); return
      }
      const minsLate = minutesUntil(activeSession.scheduled_start ?? activeSession.started_at)
      const isEarly = minsLate >= -15
      if (isEarly) {
        await supabase.from('nexus_coins_ledger').insert({
          student_id: user!.id, class_id: cls.id, session_id: activeSession.id,
          amount: 10, reason: 'early_attendance',
        })
      }
      setMarked(true)
      fetchData()
      Alert.alert('Attendance Marked', isEarly ? 'You earned 10 Nexus Coins for being on time!' : 'Your attendance has been recorded.')
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.')
    } finally {
      setMarking(false)
    }
  }

  if (loading) return <NexusLoader />
  if (!cls) return <View style={s.root}><Text style={s.errorText}>Unit not found.</Text></View>

  const upcomingSessions = sessions.filter(
    ss => !ss.is_active && !ss.ended_at && ss.scheduled_start && new Date(ss.scheduled_start) > new Date()
  )

  return (
    <View style={s.root}>
      <NexusStatusBar gpsState="active" ntpSynced />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={NexusColors.textPrimary} />
        </TouchableOpacity>
        <View style={s.headerText}>
          <Text style={s.headerTitle} numberOfLines={1}>{cls.name}</Text>
          <Text style={s.headerCode}>{cls.course_code}</Text>
        </View>
        <View style={[s.geofenceBadge, { borderColor: cls.allow_outside_geofence ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)' }]}>
          <Ionicons name={cls.allow_outside_geofence ? 'lock-open' : 'lock-closed'} size={12}
            color={cls.allow_outside_geofence ? NexusColors.accentAmber : NexusColors.accentEmerald} />
          <Text style={[s.geofenceBadgeText, { color: cls.allow_outside_geofence ? NexusColors.accentAmber : NexusColors.accentEmerald }]}>
            {cls.allow_outside_geofence ? 'Open' : 'Geo-locked'}
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData() }} tintColor={NexusColors.accentCyan} />}
        contentContainerStyle={s.scroll}>

        {message && (
          <GlassmorphicCard style={s.card} glowColor={NexusColors.accentIndigo}>
            <View style={s.rowGap}>
              <Ionicons name="megaphone-outline" size={15} color={NexusColors.accentIndigo} />
              <Text style={s.chipLabel}>MESSAGE FROM INSTRUCTOR</Text>
            </View>
            <Text style={s.messageText}>{message.message}</Text>
            <Text style={s.metaText}>{fmtDate(message.created_at)} · {fmtTime(message.created_at)}</Text>
          </GlassmorphicCard>
        )}

        {activeSession && (
          <GlassmorphicCard style={s.card} glowColor={NexusColors.accentEmerald}>
            <View style={s.rowGap}>
              <View style={s.liveDot} />
              <Text style={[s.chipLabel, { color: NexusColors.accentEmerald }]}>SESSION LIVE NOW</Text>
            </View>
            <Text style={s.metaText}>Started {fmtTime(activeSession.started_at)}</Text>
            {marked ? (
              <View style={[s.rowGap, { marginTop: 14 }]}>
                <Ionicons name="checkmark-circle" size={22} color={NexusColors.accentEmerald} />
                <Text style={s.markedText}>Attendance Recorded</Text>
              </View>
            ) : (
              <Animated.View style={[{ marginTop: 14 }, { transform: [{ scale: pulse }] }]}>
                <TouchableOpacity style={[s.markBtn, marking && { opacity: 0.6 }]}
                  onPress={markAttendance} disabled={marking} activeOpacity={0.85}>
                  <Ionicons name="finger-print-outline" size={20} color="#fff" />
                  <Text style={s.markBtnText}>{marking ? 'Verifying…' : 'Mark Attendance'}</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
            {!cls.allow_outside_geofence && cls.geofence_lat !== 0 && (
              <Text style={s.geoNote}>Must be within {cls.geofence_radius_m}m of classroom</Text>
            )}
          </GlassmorphicCard>
        )}

        {cls.scheduled_time && (
          <GlassmorphicCard style={s.card}>
            <Text style={s.sectionLabel}>WEEKLY SCHEDULE</Text>
            <View style={s.rowGap}>
              <Ionicons name="calendar-outline" size={15} color={NexusColors.accentCyan} />
              <Text style={s.scheduleText}>{cls.scheduled_time}</Text>
            </View>
          </GlassmorphicCard>
        )}

        {upcomingSessions.length > 0 && (
          <>
            <Text style={s.sectionLabel}>UPCOMING SESSIONS</Text>
            {upcomingSessions.map(ss => {
              const hasReminder = !!reminders[ss.id]
              const mins = ss.scheduled_start ? minutesUntil(ss.scheduled_start) : null
              return (
                <GlassmorphicCard key={ss.id} style={s.card} glowColor={NexusColors.accentAmber}>
                  <View style={s.sessionRow}>
                    <View>
                      <Text style={s.sessionDate}>{ss.scheduled_start ? fmtDate(ss.scheduled_start) : 'TBD'}</Text>
                      <Text style={s.sessionTime}>{ss.scheduled_start ? fmtTime(ss.scheduled_start) : '—'}</Text>
                      {mins !== null && mins > 0 && (
                        <Text style={s.metaText}>in {mins >= 60 ? `${Math.floor(mins/60)}h ${mins%60}m` : `${mins}m`}</Text>
                      )}
                    </View>
                    <TouchableOpacity style={[s.reminderBtn, hasReminder && s.reminderBtnOn]}
                      onPress={() => toggleReminder(ss)} activeOpacity={0.8}>
                      <Ionicons name={hasReminder ? 'notifications' : 'notifications-outline'} size={15}
                        color={hasReminder ? NexusColors.bgPrimary : NexusColors.accentAmber} />
                      <Text style={[s.reminderBtnText, hasReminder && { color: NexusColors.bgPrimary }]}>
                        {hasReminder ? 'On' : 'Remind Me'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {hasReminder && <Text style={s.coinNote}>Mark within 15 min of start to earn Nexus Coins</Text>}
                </GlassmorphicCard>
              )
            })}
          </>
        )}

        <Text style={s.sectionLabel}>MY ATTENDANCE ({logs.length})</Text>
        {logs.length === 0 ? (
          <GlassmorphicCard style={s.card}>
            <Text style={[s.metaText, { textAlign: 'center', paddingVertical: 12 }]}>No attendance records yet.</Text>
          </GlassmorphicCard>
        ) : (
          <GlassmorphicCard style={[s.card, { paddingHorizontal: 16 }]}>
            {logs.map((log, idx) => (
              <View key={log.id} style={[s.logRow, idx < logs.length - 1 && s.logRowBorder]}>
                <View style={s.logDot} />
                <View style={{ flex: 1 }}>
                  <Text style={s.sessionDate}>{fmtDate(log.signed_at)}</Text>
                  <Text style={s.metaText}>{fmtTime(log.signed_at)}</Text>
                </View>
                <View style={s.rowGap}>
                  <Ionicons name="checkmark-circle" size={14} color={NexusColors.accentEmerald} />
                  <Text style={[s.metaText, { color: NexusColors.accentEmerald }]}>Present</Text>
                </View>
              </View>
            ))}
          </GlassmorphicCard>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: NexusColors.bgPrimary },
  errorText: { color: NexusColors.textSecondary, textAlign: 'center', marginTop: 60, fontSize: 14 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, gap: 10 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: NexusColors.bgCardSolid, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: NexusColors.textPrimary },
  headerCode: { fontSize: 11, color: NexusColors.accentCyan, marginTop: 2, letterSpacing: 1 },
  geofenceBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: NexusRadius.full, paddingHorizontal: 8, paddingVertical: 4 },
  geofenceBadgeText: { fontSize: 10, fontWeight: '700' },
  scroll: { paddingHorizontal: 16, paddingTop: 4 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: NexusColors.textSecondary, letterSpacing: 1.5, marginBottom: 8, marginTop: 4 },
  card: { padding: 16, marginBottom: 12 },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipLabel: { fontSize: 10, fontWeight: '700', color: NexusColors.accentIndigo, letterSpacing: 1 },
  messageText: { fontSize: 14, color: NexusColors.textPrimary, lineHeight: 20, marginTop: 8 },
  metaText: { fontSize: 11, color: NexusColors.textSecondary, marginTop: 4 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: NexusColors.accentEmerald },
  markBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: NexusColors.accentEmerald, borderRadius: NexusRadius.lg, paddingVertical: 14, shadowColor: NexusColors.accentEmerald, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 },
  markBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  markedText: { fontSize: 15, fontWeight: '600', color: NexusColors.accentEmerald },
  geoNote: { fontSize: 11, color: NexusColors.textSecondary, marginTop: 10, textAlign: 'center' },
  scheduleText: { fontSize: 14, color: NexusColors.textPrimary, fontWeight: '500' },
  sessionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sessionDate: { fontSize: 13, fontWeight: '600', color: NexusColors.textPrimary },
  sessionTime: { fontSize: 20, fontWeight: '900', color: NexusColors.accentAmber, marginTop: 2 },
  reminderBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: NexusColors.accentAmber, borderRadius: NexusRadius.full, paddingHorizontal: 12, paddingVertical: 7 },
  reminderBtnOn: { backgroundColor: NexusColors.accentAmber },
  reminderBtnText: { fontSize: 12, fontWeight: '600', color: NexusColors.accentAmber },
  coinNote: { fontSize: 11, color: NexusColors.accentAmber, marginTop: 10 },
  logRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  logRowBorder: { borderBottomWidth: 1, borderBottomColor: NexusColors.borderGlass },
  logDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: NexusColors.accentEmerald },
})
