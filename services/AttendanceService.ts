import * as SecureStore from 'expo-secure-store'
import NetInfo from '@react-native-community/netinfo'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import GeofenceService from './GeofenceService'
import type { AttendanceResult, AttendanceFailReason, AttendanceLog, SessionStatus } from '../types'

export const ERRORS: Record<AttendanceFailReason, string> = {
  outside_geofence: 'You are not in the classroom.',
  poor_gps: 'GPS signal too weak. Move near a window.',
  session_not_active: 'Class session has not started yet.',
  already_signed: 'You have already signed in for this session.',
  auth_required: 'Please sign in again.',
  server_error: 'Could not mark attendance. Try again.',
}

const SESSION_KEY = 'supabase_session'
const OFFLINE_QUEUE_KEY = 'attendance_offline_queue'

interface QueuedSubmission {
  id: string
  classId: string
  coords: {
    lat: number
    lng: number
    accuracy_m: number
  }
  selfieUrl?: string
  timestamp: string
}

export class AttendanceService {
  private isProcessingQueue = false

  constructor(private supabaseClient: SupabaseClient) {
    // Set up network listener to process queue when connectivity is restored
    this.setupNetworkListener()
  }

  private setupNetworkListener() {
    NetInfo.addEventListener(state => {
      if (state.isConnected && !this.isProcessingQueue) {
        this.processOfflineQueue()
      }
    })
  }

  private async addToOfflineQueue(submission: Omit<QueuedSubmission, 'id' | 'timestamp'>) {
    try {
      const queuedSubmission: QueuedSubmission = {
        ...submission,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
      }

      const existingQueue = await SecureStore.getItemAsync(OFFLINE_QUEUE_KEY)
      const queue: QueuedSubmission[] = existingQueue ? JSON.parse(existingQueue) : []
      
      queue.push(queuedSubmission)
      await SecureStore.setItemAsync(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
      
      return true
    } catch (error) {
      console.error('Failed to add to offline queue:', error)
      return false
    }
  }

  private async processOfflineQueue() {
    if (this.isProcessingQueue) return
    
    this.isProcessingQueue = true
    
    try {
      const queueData = await SecureStore.getItemAsync(OFFLINE_QUEUE_KEY)
      if (!queueData) return
      
      const queue: QueuedSubmission[] = JSON.parse(queueData)
      if (queue.length === 0) return
      
      const processedIds: string[] = []
      
      for (const submission of queue) {
        try {
          const result = await this.submitAttendanceToServer(
            submission.classId,
            submission.coords,
            submission.selfieUrl
          )
          
          if (result.success || result.reason === 'already_signed') {
            // Mark as processed (success or already exists)
            processedIds.push(submission.id)
          }
          // If it fails for other reasons, keep it in queue for retry
        } catch (error) {
          console.error('Failed to process queued submission:', error)
          // Keep in queue for retry
        }
      }
      
      // Remove processed submissions from queue
      if (processedIds.length > 0) {
        const remainingQueue = queue.filter(item => !processedIds.includes(item.id))
        await SecureStore.setItemAsync(OFFLINE_QUEUE_KEY, JSON.stringify(remainingQueue))
      }
    } catch (error) {
      console.error('Failed to process offline queue:', error)
    } finally {
      this.isProcessingQueue = false
    }
  }

  private async submitAttendanceToServer(
    classId: string, 
    coords: { lat: number; lng: number; accuracy_m: number },
    selfieUrl?: string
  ): Promise<AttendanceResult> {
    try {
      const { data, error } = await this.supabaseClient.functions.invoke('verify-attendance', {
        body: {
          class_id: classId,
          coords,
          selfie_url: selfieUrl,
        },
      })

      if (error) {
        return { success: false, reason: 'server_error' }
      }

      if (!data.success) {
        const knownReasons: AttendanceFailReason[] = [
          'outside_geofence',
          'poor_gps',
          'session_not_active',
          'already_signed',
          'auth_required',
        ]
        const reason: AttendanceFailReason = knownReasons.includes(data.reason)
          ? data.reason
          : 'server_error'
        return { success: false, reason }
      }

      return {
        success: true,
        attendanceId: data.attendance_id,
        timestamp: data.timestamp ?? new Date().toISOString(),
      }
    } catch {
      return { success: false, reason: 'server_error' }
    }
  }

  async markAttendance(classId: string, selfieUrl?: string): Promise<AttendanceResult> {
    // 1. Verify session exists
    const raw = await SecureStore.getItemAsync(SESSION_KEY)
    if (!raw) {
      return { success: false, reason: 'auth_required' }
    }

    // 2. Get current GPS location
    const locationResult = await GeofenceService.getCurrentLocation()
    if (!locationResult.success) {
      const errorMap: Record<typeof locationResult.error, AttendanceFailReason> = {
        permission_denied: 'auth_required',
        timeout: 'poor_gps',
        unavailable: 'poor_gps',
      }
      return { success: false, reason: errorMap[locationResult.error] }
    }

    // 3. Validate GPS accuracy
    if (!GeofenceService.isAccuracyAcceptable(locationResult.accuracyMetres)) {
      return { success: false, reason: 'poor_gps' }
    }

    const coords = {
      lat: locationResult.coords.latitude,
      lng: locationResult.coords.longitude,
      accuracy_m: locationResult.accuracyMetres,
    }

    // 4. Check network connectivity
    const netState = await NetInfo.fetch()
    if (!netState.isConnected) {
      // Add to offline queue
      const queued = await this.addToOfflineQueue({ classId, coords, selfieUrl })
      if (queued) {
        return { 
          success: true, 
          attendanceId: 'queued_' + Date.now(), 
          timestamp: new Date().toISOString() 
        }
      } else {
        return { success: false, reason: 'server_error' }
      }
    }

    // 5. Submit to server
    return this.submitAttendanceToServer(classId, coords, selfieUrl)
  }

  async getAttendanceHistory(studentId: string): Promise<AttendanceLog[]> {
    const { data, error } = await this.supabaseClient
      .from('attendance_logs')
      .select('*')
      .eq('student_id', studentId)
      .order('signed_at', { ascending: false })

    if (error || !data) return []
    return data as AttendanceLog[]
  }

  async getSessionStatus(sessionId: string): Promise<SessionStatus> {
    const { data, error } = await this.supabaseClient
      .from('class_sessions')
      .select('is_active, started_at, ended_at')
      .eq('id', sessionId)
      .single()

    if (error || !data) {
      return { isActive: false, startedAt: null, endedAt: null }
    }

    return {
      isActive: data.is_active,
      startedAt: data.started_at ?? null,
      endedAt: data.ended_at ?? null,
    }
  }
}

export default new AttendanceService(supabase)
