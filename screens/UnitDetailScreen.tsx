/**
 * UnitDetailScreen — Detailed view of a single unit for instructors
 * 
 * Features:
 * - Enrolled students list with search
 * - Send message to present students
 * - Chronos (session history replay)
 * - Edit location/coordinates modal
 * - Toggle geofence enforcement
 */

import React, { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { NexusColors, NexusFonts, NexusSpacing, NexusRadius } from '@/constants/theme'
import { GlassmorphicCard } from '@/components/nexus/GlassmorphicCard'
import { NexusStatusBar } from '@/components/nexus/NexusStatusBar'
import ChronosReplay from '@/components/nexus/ChronosReplay'
import NexusLoader from '@/components/NexusLoader'
import type { Class, Profile } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface EnrolledStudent {
  id: string
  full_name: string
  student_id?: string
  email?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function UnitDetailScreen() {
  const { classId } = useLocalSearchParams<{ classId: string }>()
  const [cls, setCls] = useState<Class | null>(null)
  const [students, setStudents] = useState<EnrolledStudent[]>([])
  const [filteredStudents, setFilteredStudents] = useState<EnrolledStudent[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Modals
  const [coordModal, setCoordModal] = useState(false)
  const [messageModal, setMessageModal] = useState(false)
  const [chronosModal, setChronosModal] = useState(false)

  // Coordinate modal state
  const [inputLat, setInputLat] = useState('')
  const [inputLng, setInputLng] = useState('')
  const [inputRadius, setInputRadius] = useState('50')
  const [inputScheduledTime, setInputScheduledTime] = useState('')
  const [savingCoords, setSavingCoords] = useState(false)

  // Message modal state
  const [messageText, setMessageText] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)

  // Geofence enforcement toggle
  const [allowOutsideGeofence, setAllowOutsideGeofence] = useState(false)
  const [togglingGeofence, setTogglingGeofence] = useState(false)

  const fetchData = useCallback(async () => {
    if (!classId) return

    // Fetch class details
    const { data: classData } = await supabase
      .from('classes')
      .select('*')
      .eq('id', classId)
      .single()

    if (classData) {
      setCls(classData)
      setInputLat(classData.geofence_lat !== 0 ? String(classData.geofence_lat) : '')
      setInputLng(classData.geofence_lng !== 0 ? String(classData.geofence_lng) : '')
      setInputRadius(String(classData.geofence_radius_m))
      setInputScheduledTime(classData.scheduled_time ?? '')
      setAllowOutsideGeofence(classData.allow_outside_geofence ?? false)
    }

    // Fetch enrolled students
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('student_id, profiles(id, full_name, student_id, email)')
      .eq('class_id', classId)

    if (enrollments) {
      const studentList: EnrolledStudent[] = enrollments.map((e: any) => {
        const prof = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles
        return {
          id: e.student_id,
          full_name: prof?.full_name ?? 'Unknown',
          student_id: prof?.student_id,
          email: prof?.email,
        }
      })
      setStudents(studentList)
      setFilteredStudents(studentList)
    }

    setLoading(false)
    setRefreshing(false)
  }, [classId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Search filter
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredStudents(students)
      return
    }
    const q = searchQuery.toLowerCase()
    setFilteredStudents(
      students.filter(
        (s) =>
          s.full_name.toLowerCase().includes(q) ||
          s.student_id?.toLowerCase().includes(q) ||
          s.email?.toLowerCase().includes(q)
      )
    )
  }, [searchQuery, students])

  // ── Save coordinates ───────────────────────────────────────────────────────

  async function saveCoordinates() {
    if (!cls) return
    const lat = parseFloat(inputLat)
    const lng = parseFloat(inputLng)
    const radius = parseFloat(inputRadius)

    if (isNaN(lat) || lat < -90 || lat > 90) {
      Alert.alert('Invalid Input', 'Latitude must be between -90 and 90.')
      return
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      Alert.alert('Invalid Input', 'Longitude must be between -180 and 180.')
      return
    }
    if (isNaN(radius) || radius < 10 || radius > 500) {
      Alert.alert('Invalid Input', 'Radius must be between 10 and 500 metres.')
      return
    }

    setSavingCoords(true)
    const updates: Record<string, any> = {
      geofence_lat: lat,
      geofence_lng: lng,
      geofence_radius_m: radius,
    }
    if (inputScheduledTime.trim()) {
      updates.scheduled_time = inputScheduledTime.trim()
    }

    const { error } = await supabase.from('classes').update(updates).eq('id', cls.id)

    setSavingCoords(false)

    if (error) {
      Alert.alert('Error', 'Could not save coordinates. Please try again.')
    } else {
      setCoordModal(false)
      fetchData()
    }
  }

  // ── Send message ───────────────────────────────────────────────────────────

  async function sendMessage() {
    if (!messageText.trim()) {
      Alert.alert('Empty Message', 'Please enter a message to send.')
      return
    }
    if (!cls) return

    setSendingMessage(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('class_messages').insert({
      class_id: cls.id,
      instructor_id: user!.id,
      message: messageText.trim(),
    })
    setSendingMessage(false)

    if (error) {
      Alert.alert('Error', 'Could not send message. Please try again.')
      return
    }

    Alert.alert(
      'Message Sent',
      `Your message has been sent to ${students.length} enrolled student${students.length !== 1 ? 's' : ''}.`
    )
    setMessageModal(false)
    setMessageText('')
  }

  // ── Toggle geofence enforcement ───────────────────────────────────────────

  async function toggleGeofenceEnforcement() {
    if (!cls) return
    setTogglingGeofence(true)
    const newValue = !allowOutsideGeofence
    const { error } = await supabase
      .from('classes')
      .update({ allow_outside_geofence: newValue })
      .eq('id', cls.id)
    setTogglingGeofence(false)
    if (error) {
      Alert.alert('Error', 'Could not update geofence setting.')
      return
    }
    setAllowOutsideGeofence(newValue)
    Alert.alert(
      'Geofence Updated',
      newValue
        ? 'Students can now mark attendance from outside the geofence.'
        : 'Students must be inside the geofence to mark attendance.',
    )
  }

  if (loading) return <NexusLoader />
  if (!cls) {
    return (
      <View style={s.root}>
        <Text style={s.errorText}>Unit not found</Text>
      </View>
    )
  }

  return (
    <View style={s.root}>
      <NexusStatusBar gpsState="active" ntpSynced />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={NexusColors.textPrimary} />
        </TouchableOpacity>
        <View style={s.headerContent}>
          <Text style={s.headerTitle}>{cls.name}</Text>
          <Text style={s.headerSub}>{cls.course_code}</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              fetchData()
            }}
            tintColor={NexusColors.accentIndigo}
          />
        }
        contentContainerStyle={s.scroll}
      >
        {/* Stats card */}
        <GlassmorphicCard style={s.statsCard} glowColor={NexusColors.accentIndigo}>
          <View style={s.statRow}>
            <View style={s.statItem}>
              <Text style={s.statValue}>{students.length}</Text>
              <Text style={s.statLabel}>Enrolled</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statValue}>{cls.geofence_radius_m}m</Text>
              <Text style={s.statLabel}>Radius</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Ionicons
                name={allowOutsideGeofence ? 'lock-open' : 'lock-closed'}
                size={20}
                color={allowOutsideGeofence ? NexusColors.accentAmber : NexusColors.accentEmerald}
              />
              <Text style={s.statLabel}>
                {allowOutsideGeofence ? 'Open' : 'Restricted'}
              </Text>
            </View>
          </View>
        </GlassmorphicCard>

        {/* Quick actions */}
        <Text style={s.sectionLabel}>QUICK ACTIONS</Text>
        <View style={s.actionsGrid}>
          <TouchableOpacity
            style={[s.actionBtn, { borderColor: NexusColors.accentCyan }]}
            onPress={() => setCoordModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="location-outline" size={18} color={NexusColors.accentCyan} />
            <Text style={[s.actionBtnText, { color: NexusColors.accentCyan }]}>
              Edit Location
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.actionBtn, { borderColor: NexusColors.accentIndigo }]}
            onPress={() => setMessageModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="mail-outline" size={18} color={NexusColors.accentIndigo} />
            <Text style={[s.actionBtnText, { color: NexusColors.accentIndigo }]}>
              Send Message
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.actionBtn, { borderColor: NexusColors.accentAmber }]}
            onPress={() => setChronosModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="time-outline" size={18} color={NexusColors.accentAmber} />
            <Text style={[s.actionBtnText, { color: NexusColors.accentAmber }]}>Chronos</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              s.actionBtn,
              {
                borderColor: allowOutsideGeofence
                  ? NexusColors.accentAmber
                  : NexusColors.accentEmerald,
              },
            ]}
            onPress={toggleGeofenceEnforcement}
            disabled={togglingGeofence}
            activeOpacity={0.8}
          >
            <Ionicons
              name={allowOutsideGeofence ? 'lock-open-outline' : 'lock-closed-outline'}
              size={18}
              color={
                allowOutsideGeofence ? NexusColors.accentAmber : NexusColors.accentEmerald
              }
            />
            <Text
              style={[
                s.actionBtnText,
                {
                  color: allowOutsideGeofence
                    ? NexusColors.accentAmber
                    : NexusColors.accentEmerald,
                },
              ]}
            >
              {allowOutsideGeofence ? 'Restrict' : 'Allow Outside'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <Text style={s.sectionLabel}>ENROLLED STUDENTS</Text>
        <View style={s.searchBar}>
          <Ionicons name="search-outline" size={18} color={NexusColors.textSecondary} />
          <TextInput
            style={s.searchInput}
            placeholder="Search by name, ID, or email..."
            placeholderTextColor={NexusColors.textDisabled}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={NexusColors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Students list */}
        <GlassmorphicCard style={s.studentsCard}>
          {filteredStudents.length === 0 ? (
            <Text style={s.emptyText}>
              {searchQuery ? 'No students match your search.' : 'No students enrolled yet.'}
            </Text>
          ) : (
            filteredStudents.map((student, idx) => (
              <View
                key={student.id}
                style={[
                  s.studentRow,
                  idx < filteredStudents.length - 1 && s.studentRowBorder,
                ]}
              >
                <View style={s.studentAvatar}>
                  <Text style={s.studentInitials}>
                    {student.full_name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </Text>
                </View>
                <View style={s.studentInfo}>
                  <Text style={s.studentName}>{student.full_name}</Text>
                  {student.student_id && (
                    <Text style={s.studentMeta}>ID: {student.student_id}</Text>
                  )}
                  {student.email && (
                    <Text style={s.studentMeta}>{student.email}</Text>
                  )}
                </View>
              </View>
            ))
          )}
        </GlassmorphicCard>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Edit Location Modal ──────────────────────────────────────────────── */}
      <Modal visible={coordModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Edit Class Location</Text>
            <Text style={s.modalSubtitle}>
              {cls.name} · {cls.course_code}
            </Text>

            <Text style={s.modalLabel}>Latitude</Text>
            <TextInput
              style={s.modalInput}
              value={inputLat}
              onChangeText={setInputLat}
              placeholder="-1.286389"
              placeholderTextColor={NexusColors.textDisabled}
              keyboardType="decimal-pad"
            />

            <Text style={s.modalLabel}>Longitude</Text>
            <TextInput
              style={s.modalInput}
              value={inputLng}
              onChangeText={setInputLng}
              placeholder="36.817223"
              placeholderTextColor={NexusColors.textDisabled}
              keyboardType="decimal-pad"
            />

            <Text style={s.modalLabel}>Radius (metres, 10–500)</Text>
            <TextInput
              style={s.modalInput}
              value={inputRadius}
              onChangeText={setInputRadius}
              placeholder="50"
              placeholderTextColor={NexusColors.textDisabled}
              keyboardType="number-pad"
            />

            <Text style={s.modalLabel}>Scheduled Time (e.g. Mon/Wed 09:00–11:00)</Text>
            <TextInput
              style={s.modalInput}
              value={inputScheduledTime}
              onChangeText={setInputScheduledTime}
              placeholder="Mon/Wed 09:00–11:00"
              placeholderTextColor={NexusColors.textDisabled}
            />

            <Text style={s.modalHint}>
              💡 Tip: Open Google Maps, long-press your classroom, and copy the coordinates.
            </Text>

            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancel} onPress={() => setCoordModal(false)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalSave, savingCoords && { opacity: 0.6 }]}
                onPress={saveCoordinates}
                disabled={savingCoords}
              >
                <Text style={s.modalSaveText}>{savingCoords ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Send Message Modal ───────────────────────────────────────────────── */}
      <Modal visible={messageModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Send Message</Text>
            <Text style={s.modalSubtitle}>
              Message will be sent to {students.length} enrolled student
              {students.length !== 1 ? 's' : ''}
            </Text>

            <Text style={s.modalLabel}>Message</Text>
            <TextInput
              style={[s.modalInput, s.modalTextArea]}
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Type your message here..."
              placeholderTextColor={NexusColors.textDisabled}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={s.modalActions}>
              <TouchableOpacity
                style={s.modalCancel}
                onPress={() => {
                  setMessageModal(false)
                  setMessageText('')
                }}
              >
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalSave, sendingMessage && { opacity: 0.6 }]}
                onPress={sendMessage}
                disabled={sendingMessage}
              >
                <Text style={s.modalSaveText}>{sendingMessage ? 'Sending…' : 'Send'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Chronos Modal ────────────────────────────────────────────────────── */}
      <ChronosReplay
        visible={chronosModal}
        onClose={() => setChronosModal(false)}
        role="instructor"
        sessionName={cls.name}
      />
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: NexusColors.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: NexusColors.bgCardSolid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: NexusColors.textPrimary,
  },
  headerSub: {
    fontSize: 12,
    color: NexusColors.accentCyan,
    marginTop: 2,
    letterSpacing: 1,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  errorText: {
    color: NexusColors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
  },
  // Stats
  statsCard: {
    paddingVertical: 20,
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    color: NexusColors.accentIndigo,
  },
  statLabel: {
    fontSize: 11,
    color: NexusColors.textSecondary,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: NexusColors.borderGlass,
  },
  // Section
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: NexusColors.textSecondary,
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 8,
  },
  // Actions
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flex: 1,
    minWidth: '47%',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: NexusColors.bgCardSolid,
    borderWidth: 1,
    borderColor: NexusColors.borderGlow,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: NexusColors.textPrimary,
    fontSize: 14,
  },
  // Students
  studentsCard: {
    paddingHorizontal: 16,
  },
  emptyText: {
    color: NexusColors.textSecondary,
    fontSize: 13,
    paddingVertical: 24,
    textAlign: 'center',
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  studentRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: NexusColors.borderGlass,
  },
  studentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: NexusColors.accentIndigo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentInitials: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '600',
    color: NexusColors.textPrimary,
  },
  studentMeta: {
    fontSize: 11,
    color: NexusColors.textSecondary,
    marginTop: 2,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: NexusColors.bgCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    borderTopWidth: 1,
    borderColor: NexusColors.borderGlow,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: NexusColors.textPrimary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: NexusColors.accentCyan,
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 12,
    color: NexusColors.textSecondary,
    marginBottom: 4,
    marginTop: 8,
    letterSpacing: 0.5,
  },
  modalInput: {
    backgroundColor: NexusColors.bgCardSolid,
    borderWidth: 1,
    borderColor: NexusColors.borderGlow,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: NexusColors.textPrimary,
    fontSize: 14,
  },
  modalTextArea: {
    minHeight: 100,
    paddingTop: 10,
  },
  modalHint: {
    fontSize: 11,
    color: NexusColors.textSecondary,
    marginTop: 8,
    lineHeight: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: NexusColors.borderGlow,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    color: NexusColors.textSecondary,
    fontWeight: '600',
  },
  modalSave: {
    flex: 1,
    backgroundColor: NexusColors.accentIndigo,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#fff',
    fontWeight: '700',
  },
})
