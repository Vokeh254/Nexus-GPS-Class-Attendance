import React, { useCallback, useEffect, useState } from 'react'
import {
  Alert, Modal, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { NexusColors } from '@/constants/theme'
import { GlassmorphicCard } from '@/components/nexus/GlassmorphicCard'
import { NexusStatusBar } from '@/components/nexus/NexusStatusBar'
import NexusLoader from '@/components/NexusLoader'
import type { Class, ClassSession } from '@/types'
import { SessionScheduler } from '@/services/SessionScheduler'
import * as Location from 'expo-location'

// ── Types ─────────────────────────────────────────────────────────────────────

type SessionStatus = 'upcoming' | 'active' | 'ended' | 'none'

interface UnitWithSession {
  cls: Class
  todaySession: ClassSession | null
  sessionStatus: SessionStatus
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todaySessionStatus(session: ClassSession | null): SessionStatus {
  if (!session) return 'none'
  if (session.is_active) return 'active'
  if (session.ended_at) return 'ended'
  if (session.scheduled_start && new Date(session.scheduled_start) > new Date()) return 'upcoming'
  return 'upcoming'
}

function statusColor(s: SessionStatus) {
  switch (s) {
    case 'active':   return NexusColors.accentEmerald
    case 'upcoming': return NexusColors.accentAmber
    case 'ended':    return NexusColors.textDisabled
    default:         return NexusColors.textDisabled
  }
}

function statusLabel(s: SessionStatus) {
  switch (s) {
    case 'active':   return '● LIVE'
    case 'upcoming': return '⏰ UPCOMING'
    case 'ended':    return '✓ ENDED'
    default:         return '— NO SESSION'
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function InstructorUnitsScreen() {
  const [units, setUnits] = useState<UnitWithSession[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  // ── Add unit modal ─────────────────────────────────────────────────────────
  const [addModal, setAddModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newScheduledTime, setNewScheduledTime] = useState('')
  const [adding, setAdding] = useState(false)

  // ── Coordinate picker modal ────────────────────────────────────────────────
  const [coordModal, setCoordModal] = useState(false)
  const [selectedClass, setSelectedClass] = useState<Class | null>(null)
  const [inputLat, setInputLat] = useState('')
  const [inputLng, setInputLng] = useState('')
  const [inputRadius, setInputRadius] = useState('50')
  const [inputScheduledTime, setInputScheduledTime] = useState('')
  const [savingCoords, setSavingCoords] = useState(false)
  const [fetchingLocation, setFetchingLocation] = useState(false)

  // ── Schedule session modal ─────────────────────────────────────────────────
  const [scheduleModal, setScheduleModal] = useState(false)
  const [scheduleClass, setScheduleClass] = useState<Class | null>(null)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [scheduling, setScheduling] = useState(false)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchUnits = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const { data: classes } = await supabase
      .from('classes')
      .select('*')
      .eq('instructor_id', user.id)
      .order('created_at', { ascending: true })

    if (!classes) { setLoading(false); setRefreshing(false); return }

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999)

    const results: UnitWithSession[] = await Promise.all(
      classes.map(async (cls: Class) => {
        const { data: sessions } = await supabase
          .from('class_sessions').select('*')
          .eq('class_id', cls.id)
          .gte('scheduled_start', todayStart.toISOString())
          .lte('scheduled_start', todayEnd.toISOString())
          .order('scheduled_start', { ascending: true }).limit(5)

        const { data: activeSession } = await supabase
          .from('class_sessions').select('*')
          .eq('class_id', cls.id).eq('is_active', true).maybeSingle()

        const todaySession: ClassSession | null =
          activeSession ?? (sessions && sessions.length > 0 ? sessions[0] : null)

        return { cls, todaySession, sessionStatus: todaySessionStatus(todaySession) }
      })
    )

    setUnits(results)
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    fetchUnits()
    SessionScheduler.start()
    return () => SessionScheduler.stop()
  }, [fetchUnits])

  // ── Add unit ───────────────────────────────────────────────────────────────

  async function addUnit() {
    if (!newName.trim()) { Alert.alert('Required', 'Unit name is required.'); return }
    if (!newCode.trim()) { Alert.alert('Required', 'Unit code is required.'); return }

    // Always get user directly — don't rely on userId state
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      Alert.alert('Not Signed In', 'Please sign out and sign back in.')
      return
    }

    setAdding(true)

    const { data, error } = await supabase
      .from('classes')
      .insert({
        instructor_id: user.id,
        name: newName.trim(),
        course_code: newCode.trim().toUpperCase(),
        geofence_lat: 0,
        geofence_lng: 0,
        geofence_radius_m: 50,
        ...(newScheduledTime.trim() ? { scheduled_time: newScheduledTime.trim() } : {}),
      })
      .select()
      .single()

    setAdding(false)

    if (error) {
      Alert.alert(
        'Add Unit Failed',
        `Code: ${error.code}\n\n${error.message}\n\nHint: ${error.hint ?? 'none'}`
      )
      return
    }

    if (!data) {
      Alert.alert('Add Unit Failed', 'No data returned. Check Supabase logs.')
      return
    }

    setAddModal(false)
    setNewName('')
    setNewCode('')
    setNewScheduledTime('')
    fetchUnits()
  }

  // ── Remove unit ────────────────────────────────────────────────────────────

  function confirmRemove(cls: Class) {
    Alert.alert(
      'Remove Unit',
      `Remove "${cls.name}" (${cls.course_code})?\n\nThis will also delete all sessions and attendance records for this unit.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeUnit(cls.id),
        },
      ]
    )
  }

  async function removeUnit(classId: string) {
    const { error } = await supabase.from('classes').delete().eq('id', classId)
    if (error) {
      console.error('Remove unit error:', error)
      Alert.alert(
        'Could Not Remove Unit',
        error.code === '42501'
          ? 'Permission denied. Please run migration 008_fix_classes_rls.sql in your Supabase SQL Editor.'
          : error.message
      )
    } else {
      fetchUnits()
    }
  }

  // ── Save coordinates ───────────────────────────────────────────────────────

  async function saveCoordinates() {
    if (!selectedClass) return
    const lat = parseFloat(inputLat)
    const lng = parseFloat(inputLng)
    const radius = parseFloat(inputRadius)

    if (isNaN(lat) || lat < -90 || lat > 90) { Alert.alert('Invalid', 'Latitude must be -90 to 90.'); return }
    if (isNaN(lng) || lng < -180 || lng > 180) { Alert.alert('Invalid', 'Longitude must be -180 to 180.'); return }
    if (isNaN(radius) || radius < 10 || radius > 500) { Alert.alert('Invalid', 'Radius must be 10–500 metres.'); return }

    setSavingCoords(true)
    const updates: Record<string, any> = { geofence_lat: lat, geofence_lng: lng, geofence_radius_m: radius }
    if (inputScheduledTime.trim()) updates.scheduled_time = inputScheduledTime.trim()

    const { error } = await supabase.from('classes').update(updates).eq('id', selectedClass.id)
    setSavingCoords(false)

    if (error) { Alert.alert('Error', 'Could not save coordinates.') }
    else { setCoordModal(false); fetchUnits() }
  }

  // ── Use current location ───────────────────────────────────────────────────

  async function useCurrentLocation() {
    setFetchingLocation(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to use current location.')
        return
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      setInputLat(pos.coords.latitude.toFixed(7))
      setInputLng(pos.coords.longitude.toFixed(7))
    } catch {
      Alert.alert('Error', 'Could not get current location. Try again.')
    } finally {
      setFetchingLocation(false)
    }
  }

  // ── Start session now ──────────────────────────────────────────────────────

  async function startSessionNow(cls: Class) {
    if (!userId) return
    Alert.alert(
      'Start Session',
      `Start a live session for "${cls.name}" now?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: async () => {
            const now = new Date().toISOString()
            const { error } = await supabase.from('class_sessions').insert({
              class_id: cls.id,
              instructor_id: userId,
              started_at: now,
              scheduled_start: now,
              is_active: true,
            })
            if (error) { Alert.alert('Error', error.message) }
            else { fetchUnits() }
          },
        },
      ]
    )
  }

  // ── End active session ─────────────────────────────────────────────────────

  async function endSession(session: ClassSession, cls: Class) {
    Alert.alert(
      'End Session',
      `End the live session for "${cls.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('class_sessions')
              .update({ is_active: false, ended_at: new Date().toISOString() })
              .eq('id', session.id)
            if (error) { Alert.alert('Error', error.message) }
            else { fetchUnits() }
          },
        },
      ]
    )
  }

  // ── Schedule session ───────────────────────────────────────────────────────

  async function scheduleSession() {
    if (!scheduleClass || !userId) return
    if (!scheduleDate.match(/^\d{4}-\d{2}-\d{2}$/)) { Alert.alert('Invalid Date', 'Use YYYY-MM-DD'); return }
    if (!scheduleTime.match(/^\d{2}:\d{2}$/)) { Alert.alert('Invalid Time', 'Use HH:MM'); return }

    const scheduledStart = new Date(`${scheduleDate}T${scheduleTime}:00`)
    if (isNaN(scheduledStart.getTime())) { Alert.alert('Invalid', 'Check date and time.'); return }

    setScheduling(true)
    const { error } = await supabase.from('class_sessions').insert({
      class_id: scheduleClass.id,
      instructor_id: userId,
      started_at: scheduledStart.toISOString(),
      scheduled_start: scheduledStart.toISOString(),
      is_active: false,
    })
    setScheduling(false)

    if (error) { Alert.alert('Error', error.message) }
    else {
      setScheduleModal(false)
      await SessionScheduler.checkNow()
      fetchUnits()
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function openCoordModal(cls: Class) {
    setSelectedClass(cls)
    setInputLat(cls.geofence_lat !== 0 ? String(cls.geofence_lat) : '')
    setInputLng(cls.geofence_lng !== 0 ? String(cls.geofence_lng) : '')
    setInputRadius(String(cls.geofence_radius_m))
    setInputScheduledTime(cls.scheduled_time ?? '')
    setCoordModal(true)
  }

  function openScheduleModal(cls: Class) {
    setScheduleClass(cls)
    const now = new Date()
    setScheduleDate(now.toISOString().slice(0, 10))
    setScheduleTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
    setScheduleModal(true)
  }

  if (loading) return <NexusLoader />

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={s.root}>
      <NexusStatusBar gpsState="active" ntpSynced />

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>MY UNITS</Text>
          <Text style={s.headerSub}>{units.length} unit{units.length !== 1 ? 's' : ''} assigned</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => setAddModal(true)} activeOpacity={0.8}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={s.addBtnText}>Add Unit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchUnits() }}
            tintColor={NexusColors.accentIndigo}
          />
        }
        contentContainerStyle={s.scroll}
      >
        {units.length === 0 ? (
          <GlassmorphicCard style={s.emptyCard}>
            <Ionicons name="book-outline" size={40} color={NexusColors.textDisabled} />
            <Text style={s.emptyText}>No units yet.</Text>
            <Text style={s.emptySubText}>Tap "Add Unit" to create your first unit.</Text>
          </GlassmorphicCard>
        ) : (
          units.map(({ cls, todaySession, sessionStatus }) => (
            <TouchableOpacity
              key={cls.id}
              activeOpacity={0.85}
              onPress={() => router.push({ pathname: '/unit-detail', params: { classId: cls.id } })}
            >
              <GlassmorphicCard style={s.unitCard} glowColor={statusColor(sessionStatus)}>

                {/* Header row */}
                <View style={s.unitHeader}>
                  <View style={s.unitTitleBlock}>
                    <Text style={s.unitName}>{cls.name}</Text>
                    <Text style={s.unitCode}>{cls.course_code}</Text>
                  </View>
                  <View style={s.unitHeaderRight}>
                    <View style={[s.statusPill, { borderColor: statusColor(sessionStatus) }]}>
                      <Text style={[s.statusText, { color: statusColor(sessionStatus) }]}>
                        {statusLabel(sessionStatus)}
                      </Text>
                    </View>
                    {/* Remove button */}
                    <TouchableOpacity
                      style={s.removeBtn}
                      onPress={(e) => { e.stopPropagation(); confirmRemove(cls) }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={16} color={NexusColors.accentRose} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Meta rows */}
                {cls.scheduled_time ? (
                  <View style={s.metaRow}>
                    <Ionicons name="time-outline" size={13} color={NexusColors.textSecondary} />
                    <Text style={s.metaText}>{cls.scheduled_time}</Text>
                  </View>
                ) : null}

                {cls.geofence_lat !== 0 ? (
                  <View style={s.metaRow}>
                    <Ionicons name="location-outline" size={13} color={NexusColors.textSecondary} />
                    <Text style={s.metaText}>
                      {cls.geofence_lat.toFixed(5)}, {cls.geofence_lng.toFixed(5)} · r={cls.geofence_radius_m}m
                    </Text>
                  </View>
                ) : (
                  <View style={s.metaRow}>
                    <Ionicons name="warning-outline" size={13} color={NexusColors.accentAmber} />
                    <Text style={[s.metaText, { color: NexusColors.accentAmber }]}>No coordinates set</Text>
                  </View>
                )}

                {todaySession?.scheduled_start ? (
                  <View style={s.metaRow}>
                    <Ionicons name="calendar-outline" size={13} color={NexusColors.textSecondary} />
                    <Text style={s.metaText}>
                      Today {new Date(todaySession.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                ) : null}

                {/* Action buttons */}
                <View style={s.actionRow}>
                  <TouchableOpacity
                    style={s.actionBtn}
                    onPress={(e) => { e.stopPropagation(); openCoordModal(cls) }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="map-outline" size={14} color={NexusColors.accentCyan} />
                    <Text style={s.actionBtnText}>Set Location</Text>
                  </TouchableOpacity>

                  {sessionStatus === 'active' && todaySession ? (
                    <TouchableOpacity
                      style={[s.actionBtn, { borderColor: NexusColors.accentRose }]}
                      onPress={(e) => { e.stopPropagation(); endSession(todaySession, cls) }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="stop-circle-outline" size={14} color={NexusColors.accentRose} />
                      <Text style={[s.actionBtnText, { color: NexusColors.accentRose }]}>End Session</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[s.actionBtn, { borderColor: NexusColors.accentEmerald }]}
                      onPress={(e) => { e.stopPropagation(); startSessionNow(cls) }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="play-circle-outline" size={14} color={NexusColors.accentEmerald} />
                      <Text style={[s.actionBtnText, { color: NexusColors.accentEmerald }]}>Start Session</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={s.actionRow}>
                  <TouchableOpacity
                    style={[s.actionBtn, { borderColor: NexusColors.accentIndigo }]}
                    onPress={(e) => { e.stopPropagation(); openScheduleModal(cls) }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="calendar-outline" size={14} color={NexusColors.accentIndigo} />
                    <Text style={[s.actionBtnText, { color: NexusColors.accentIndigo }]}>Schedule</Text>
                  </TouchableOpacity>
                </View>

              </GlassmorphicCard>
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Add Unit Modal ──────────────────────────────────────────────────── */}
      <Modal visible={addModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalTitleRow}>
              <Text style={s.modalTitle}>Add New Unit</Text>
              <TouchableOpacity onPress={() => setAddModal(false)}>
                <Ionicons name="close" size={22} color={NexusColors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={s.modalLabel}>Unit Name *</Text>
            <TextInput
              style={s.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Cloud Computing"
              placeholderTextColor={NexusColors.textDisabled}
              autoFocus
            />

            <Text style={s.modalLabel}>Unit Code *</Text>
            <TextInput
              style={s.modalInput}
              value={newCode}
              onChangeText={setNewCode}
              placeholder="e.g. CS410"
              placeholderTextColor={NexusColors.textDisabled}
              autoCapitalize="characters"
            />

            <Text style={s.modalLabel}>Scheduled Time (optional)</Text>
            <TextInput
              style={s.modalInput}
              value={newScheduledTime}
              onChangeText={setNewScheduledTime}
              placeholder="e.g. Mon/Wed 09:00–11:00"
              placeholderTextColor={NexusColors.textDisabled}
            />

            <Text style={s.modalHint}>
              You can set GPS coordinates after creating the unit.
            </Text>

            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancel} onPress={() => setAddModal(false)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalSave, adding && { opacity: 0.6 }]}
                onPress={addUnit}
                disabled={adding}
              >
                <Text style={s.modalSaveText}>{adding ? 'Adding…' : 'Add Unit'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Coordinate Picker Modal ─────────────────────────────────────────── */}
      <Modal visible={coordModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalTitleRow}>
              <Text style={s.modalTitle}>Set Coordinates</Text>
              <TouchableOpacity onPress={() => setCoordModal(false)}>
                <Ionicons name="close" size={22} color={NexusColors.textSecondary} />
              </TouchableOpacity>
            </View>
            {selectedClass && (
              <Text style={s.modalSubtitle}>{selectedClass.name} · {selectedClass.course_code}</Text>
            )}

            {/* Use Current Location button */}
            <TouchableOpacity
              style={s.locationBtn}
              onPress={useCurrentLocation}
              disabled={fetchingLocation}
              activeOpacity={0.8}
            >
              {fetchingLocation ? (
                <ActivityIndicator size="small" color={NexusColors.accentEmerald} />
              ) : (
                <Ionicons name="locate-outline" size={16} color={NexusColors.accentEmerald} />
              )}
              <Text style={s.locationBtnText}>
                {fetchingLocation ? 'Getting location…' : 'Use Current Location'}
              </Text>
            </TouchableOpacity>

            <Text style={s.modalLabel}>Latitude</Text>
            <TextInput style={s.modalInput} value={inputLat} onChangeText={setInputLat}
              placeholder="-1.286389" placeholderTextColor={NexusColors.textDisabled} keyboardType="decimal-pad" />

            <Text style={s.modalLabel}>Longitude</Text>
            <TextInput style={s.modalInput} value={inputLng} onChangeText={setInputLng}
              placeholder="36.817223" placeholderTextColor={NexusColors.textDisabled} keyboardType="decimal-pad" />

            <Text style={s.modalLabel}>Radius (metres, 10–500)</Text>
            <TextInput style={s.modalInput} value={inputRadius} onChangeText={setInputRadius}
              placeholder="50" placeholderTextColor={NexusColors.textDisabled} keyboardType="number-pad" />

            <Text style={s.modalLabel}>Scheduled Time</Text>
            <TextInput style={s.modalInput} value={inputScheduledTime} onChangeText={setInputScheduledTime}
              placeholder="Mon/Wed 09:00–11:00" placeholderTextColor={NexusColors.textDisabled} />

            <Text style={s.modalHint}>
              💡 Open Google Maps → long-press your classroom → copy the coordinates shown.
            </Text>

            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancel} onPress={() => setCoordModal(false)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalSave, savingCoords && { opacity: 0.6 }]}
                onPress={saveCoordinates} disabled={savingCoords}>
                <Text style={s.modalSaveText}>{savingCoords ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Schedule Session Modal ──────────────────────────────────────────── */}
      <Modal visible={scheduleModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalTitleRow}>
              <Text style={s.modalTitle}>Schedule Session</Text>
              <TouchableOpacity onPress={() => setScheduleModal(false)}>
                <Ionicons name="close" size={22} color={NexusColors.textSecondary} />
              </TouchableOpacity>
            </View>
            {scheduleClass && (
              <Text style={s.modalSubtitle}>{scheduleClass.name} · {scheduleClass.course_code}</Text>
            )}
            <Text style={s.modalHint}>Session auto-starts when the scheduled time is reached.</Text>

            <Text style={s.modalLabel}>Date (YYYY-MM-DD)</Text>
            <TextInput style={s.modalInput} value={scheduleDate} onChangeText={setScheduleDate}
              placeholder="2026-04-25" placeholderTextColor={NexusColors.textDisabled} keyboardType="numbers-and-punctuation" />

            <Text style={s.modalLabel}>Time (HH:MM, 24-hour)</Text>
            <TextInput style={s.modalInput} value={scheduleTime} onChangeText={setScheduleTime}
              placeholder="09:00" placeholderTextColor={NexusColors.textDisabled} keyboardType="numbers-and-punctuation" />

            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancel} onPress={() => setScheduleModal(false)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalSave, scheduling && { opacity: 0.6 }]}
                onPress={scheduleSession} disabled={scheduling}>
                <Text style={s.modalSaveText}>{scheduling ? 'Scheduling…' : 'Schedule'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: NexusColors.bgPrimary },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 18, fontWeight: '700',
    color: NexusColors.textPrimary, letterSpacing: 2,
  },
  headerSub: { fontSize: 12, color: NexusColors.textSecondary, marginTop: 2 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: NexusColors.accentIndigo,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  scroll: { paddingHorizontal: 16, paddingTop: 8 },
  emptyCard: { padding: 32, alignItems: 'center', gap: 8 },
  emptyText: { color: NexusColors.textPrimary, fontSize: 15, fontWeight: '600', marginTop: 8 },
  emptySubText: { color: NexusColors.textSecondary, fontSize: 12 },
  unitCard: { padding: 16, marginBottom: 12 },
  unitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  unitTitleBlock: { flex: 1, marginRight: 8 },
  unitName: { fontSize: 15, fontWeight: '700', color: NexusColors.textPrimary },
  unitCode: { fontSize: 12, color: NexusColors.accentCyan, marginTop: 2, letterSpacing: 1 },
  unitHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusPill: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  removeBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(239,68,68,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  metaText: { fontSize: 12, color: NexusColors.textSecondary },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, borderWidth: 1, borderColor: NexusColors.accentCyan,
    borderRadius: 8, paddingVertical: 8,
  },
  actionBtnText: { fontSize: 12, color: NexusColors.accentCyan, fontWeight: '600' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: NexusColors.bgCard,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, borderTopWidth: 1, borderColor: NexusColors.borderGlow,
  },
  modalTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: NexusColors.textPrimary },
  modalSubtitle: { fontSize: 13, color: NexusColors.accentCyan, marginBottom: 12 },
  modalLabel: { fontSize: 12, color: NexusColors.textSecondary, marginBottom: 4, marginTop: 10, letterSpacing: 0.5 },
  modalInput: {
    backgroundColor: NexusColors.bgCardSolid, borderWidth: 1,
    borderColor: NexusColors.borderGlow, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    color: NexusColors.textPrimary, fontSize: 14,
  },
  modalHint: { fontSize: 11, color: NexusColors.textSecondary, marginTop: 8, lineHeight: 16 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalCancel: {
    flex: 1, borderWidth: 1, borderColor: NexusColors.borderGlow,
    borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  modalCancelText: { color: NexusColors.textSecondary, fontWeight: '600' },
  modalSave: {
    flex: 1, backgroundColor: NexusColors.accentIndigo,
    borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  modalSaveText: { color: '#fff', fontWeight: '700' },
  locationBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: NexusColors.accentEmerald,
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14,
    marginBottom: 4, marginTop: 8,
  },
  locationBtnText: { color: NexusColors.accentEmerald, fontWeight: '600', fontSize: 13 },
})
