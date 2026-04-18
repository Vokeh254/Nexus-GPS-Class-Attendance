import type { Session, User } from '@supabase/supabase-js'

// ── Data Models ──────────────────────────────────────────────────────────────

export interface Profile {
  id: string
  role: 'student' | 'instructor'
  full_name: string
  student_id?: string
  created_at: string
}

export interface Class {
  id: string
  instructor_id: string
  name: string
  course_code: string
  geofence_lat: number
  geofence_lng: number
  geofence_radius_m: number
  selfie_required: boolean
  created_at: string
}

export interface ClassSession {
  id: string
  class_id: string
  instructor_id: string
  started_at: string
  ended_at?: string
  is_active: boolean
}

export interface Enrollment {
  id: string
  student_id: string
  class_id: string
  enrolled_at: string
}

export interface AttendanceLog {
  id: string
  session_id: string
  student_id: string
  class_id: string
  signed_at: string
  latitude: number
  longitude: number
  accuracy_m: number
  verified: boolean
  selfie_url?: string
}

export interface Report {
  id: string
  session_id: string
  class_id: string
  generated_at: string
  total_enrolled: number
  total_present: number
  report_url?: string
  summary: any
}

// ── Geo types ─────────────────────────────────────────────────────────────────

export interface Coordinates {
  latitude: number
  longitude: number
}

export interface Geofence {
  latitude: number
  longitude: number
  radius_m: number
}

// ── Auth types ────────────────────────────────────────────────────────────────

export type AuthResult =
  | { success: true; session: Session; user: User }
  | { success: false; error: string }

// ── Attendance types ──────────────────────────────────────────────────────────

export type AttendanceFailReason =
  | 'outside_geofence'
  | 'poor_gps'
  | 'session_not_active'
  | 'already_signed'
  | 'auth_required'
  | 'server_error'

export type AttendanceResult =
  | { success: true; attendanceId: string; timestamp: string }
  | { success: false; reason: AttendanceFailReason }

export type SessionStatus = {
  isActive: boolean
  startedAt: string | null
  endedAt: string | null
}

// ── Location types ────────────────────────────────────────────────────────────

export type LocationResult =
  | { success: true; coords: Coordinates; accuracyMetres: number }
  | { success: false; error: 'permission_denied' | 'timeout' | 'unavailable' }

export type GeofenceCheckResult =
  | { inside: true }
  | { inside: false; distanceMetres: number; reason: string }

// ── Report / Analytics types ──────────────────────────────────────────────────

export type ReportResult =
  | { success: true; data: ClassReport }
  | { success: false; error: string }

export type StudentAnalytics = {
  totalSessions: number
  attended: number
  attendanceRate: number // 0.0 – 1.0
  recentLogs: AttendanceLog[]
}

export type ClassReport = {
  sessionId: string
  date: string
  totalEnrolled: number
  totalPresent: number
  attendanceRate: number
  students: { studentId: string; name: string; present: boolean; timestamp?: string }[]
  reportUrl?: string
}
