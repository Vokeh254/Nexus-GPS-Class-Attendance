import * as SecureStore from 'expo-secure-store'
import { AttendanceService } from '../AttendanceService'
import type { SupabaseClient } from '@supabase/supabase-js'

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
}))

jest.mock('../GeofenceService', () => ({
  __esModule: true,
  default: {
    getCurrentLocation: jest.fn(),
    isAccuracyAcceptable: jest.fn(),
  },
}))

jest.mock('../../lib/supabase', () => ({
  supabase: {
    functions: { invoke: jest.fn() },
    from: jest.fn(),
  },
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

// Import after mocks are set up
import GeofenceService from '../GeofenceService'

const mockGetCurrentLocation = GeofenceService.getCurrentLocation as jest.Mock
const mockIsAccuracyAcceptable = GeofenceService.isAccuracyAcceptable as jest.Mock
const mockGetItemAsync = SecureStore.getItemAsync as jest.Mock

const FAKE_SESSION = JSON.stringify({ access_token: 'tok', expires_at: 9999999999 })
const GOOD_LOCATION = {
  success: true as const,
  coords: { latitude: 51.5, longitude: -0.1 },
  accuracyMetres: 10,
}

function makeSupabase(invokeResult: object): SupabaseClient {
  return {
    functions: {
      invoke: jest.fn().mockResolvedValue(invokeResult),
    },
  } as unknown as SupabaseClient
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AttendanceService.markAttendance', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Default: session present, good location, acceptable accuracy
    mockGetItemAsync.mockResolvedValue(FAKE_SESSION)
    mockGetCurrentLocation.mockResolvedValue(GOOD_LOCATION)
    mockIsAccuracyAcceptable.mockReturnValue(true)
  })

  // ── 1. Success path (Req 5.1) ─────────────────────────────────────────────

  describe('success path', () => {
    it('returns { success: true, attendanceId, timestamp } when Edge Function succeeds', async () => {
      const supabase = makeSupabase({
        data: { success: true, attendance_id: 'att-123', timestamp: '2024-01-01T10:00:00Z' },
        error: null,
      })
      const service = new AttendanceService(supabase)

      const result = await service.markAttendance('class-1')

      expect(result).toEqual({
        success: true,
        attendanceId: 'att-123',
        timestamp: '2024-01-01T10:00:00Z',
      })
    })

    it('uses a fallback timestamp when Edge Function omits it', async () => {
      const supabase = makeSupabase({
        data: { success: true, attendance_id: 'att-456' },
        error: null,
      })
      const service = new AttendanceService(supabase)

      const result = await service.markAttendance('class-1')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.attendanceId).toBe('att-456')
        expect(typeof result.timestamp).toBe('string')
        expect(result.timestamp.length).toBeGreaterThan(0)
      }
    })
  })

  // ── 2. Failure reasons from Edge Function (Req 5.9) ──────────────────────

  describe('failure reasons surfaced from Edge Function', () => {
    const edgeFunctionFailureCases: Array<{ reason: string }> = [
      { reason: 'outside_geofence' },
      { reason: 'poor_gps' },
      { reason: 'session_not_active' },
      { reason: 'already_signed' },
    ]

    edgeFunctionFailureCases.forEach(({ reason }) => {
      it(`returns { success: false, reason: '${reason}' } when Edge Function returns that reason`, async () => {
        const supabase = makeSupabase({
          data: { success: false, reason },
          error: null,
        })
        const service = new AttendanceService(supabase)

        const result = await service.markAttendance('class-1')

        expect(result).toEqual({ success: false, reason })
      })
    })
  })

  // ── 3. Client-side poor_gps (Req 5.9) ────────────────────────────────────

  describe('client-side GPS accuracy check', () => {
    it('returns poor_gps when isAccuracyAcceptable() returns false', async () => {
      mockIsAccuracyAcceptable.mockReturnValue(false)
      const supabase = makeSupabase({ data: null, error: null })
      const service = new AttendanceService(supabase)

      const result = await service.markAttendance('class-1')

      expect(result).toEqual({ success: false, reason: 'poor_gps' })
      // Edge Function should NOT have been called
      expect((supabase.functions.invoke as jest.Mock)).not.toHaveBeenCalled()
    })
  })

  // ── 4. auth_required when no session (Req 5.9) ───────────────────────────

  describe('auth_required', () => {
    it('returns auth_required when SecureStore has no session', async () => {
      mockGetItemAsync.mockResolvedValue(null)
      const supabase = makeSupabase({ data: null, error: null })
      const service = new AttendanceService(supabase)

      const result = await service.markAttendance('class-1')

      expect(result).toEqual({ success: false, reason: 'auth_required' })
      expect(mockGetCurrentLocation).not.toHaveBeenCalled()
    })
  })

  // ── 5. server_error when Edge Function throws (Req 5.9) ──────────────────

  describe('server_error', () => {
    it('returns server_error when Edge Function throws an exception', async () => {
      const supabase = {
        functions: {
          invoke: jest.fn().mockRejectedValue(new Error('Network failure')),
        },
      } as unknown as SupabaseClient
      const service = new AttendanceService(supabase)

      const result = await service.markAttendance('class-1')

      expect(result).toEqual({ success: false, reason: 'server_error' })
    })

    it('returns server_error when Edge Function returns an error object', async () => {
      const supabase = makeSupabase({
        data: null,
        error: { message: 'Internal server error' },
      })
      const service = new AttendanceService(supabase)

      const result = await service.markAttendance('class-1')

      expect(result).toEqual({ success: false, reason: 'server_error' })
    })
  })
})
