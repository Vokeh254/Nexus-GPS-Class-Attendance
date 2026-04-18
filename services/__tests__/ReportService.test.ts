import { ReportService } from '../ReportService'
import type { SupabaseClient } from '@supabase/supabase-js'

jest.mock('../../lib/supabase', () => ({
  supabase: {},
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Creates a mock Supabase client where:
 *  - class_sessions count query returns `totalSessions`
 *  - attendance_logs count query returns `attended`
 *  - attendance_logs data query returns `recentLogs`
 */
function makeSupabase(opts: {
  totalSessions: number | null
  attended: number | null
  recentLogs?: object[]
}): SupabaseClient {
  const { totalSessions, attended, recentLogs = [] } = opts

  // Track how many times `from` has been called for attendance_logs
  // to distinguish the count query from the data query.
  let attendanceLogsCallCount = 0

  const makeChain = (tableName: string) => {
    if (tableName === 'class_sessions') {
      // Returns count for class_sessions
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        then: (resolve: Function) => resolve({ count: totalSessions, error: null }),
      }
      return chain
    }

    if (tableName === 'attendance_logs') {
      attendanceLogsCallCount++
      const callIndex = attendanceLogsCallCount

      if (callIndex === 1) {
        // First call: count query
        const chain: any = {
          select: () => chain,
          eq: () => chain,
          then: (resolve: Function) => resolve({ count: attended, error: null }),
        }
        return chain
      } else {
        // Second call: recent logs data query
        const chain: any = {
          select: () => chain,
          eq: () => chain,
          order: () => chain,
          limit: () => chain,
          then: (resolve: Function) => resolve({ data: recentLogs, error: null }),
        }
        return chain
      }
    }

    // Fallback
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      limit: () => chain,
      single: () => chain,
      then: (resolve: Function) => resolve({ data: null, error: null }),
    }
    return chain
  }

  return {
    from: jest.fn().mockImplementation(makeChain),
  } as unknown as SupabaseClient
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ReportService.getStudentAnalytics', () => {
  // ── Requirement 8.2: attendance rate computation ──────────────────────────

  it('computes attendanceRate = 0.6 when attended=3, totalSessions=5', async () => {
    const client = makeSupabase({ totalSessions: 5, attended: 3 })
    const service = new ReportService(client)

    const result = await service.getStudentAnalytics('student-1', 'class-1')

    expect(result.totalSessions).toBe(5)
    expect(result.attended).toBe(3)
    expect(result.attendanceRate).toBeCloseTo(0.6)
  })

  it('computes attendanceRate = 0.5 when attended=2, totalSessions=4', async () => {
    const client = makeSupabase({ totalSessions: 4, attended: 2 })
    const service = new ReportService(client)

    const result = await service.getStudentAnalytics('student-1', 'class-1')

    expect(result.totalSessions).toBe(4)
    expect(result.attended).toBe(2)
    expect(result.attendanceRate).toBeCloseTo(0.5)
  })

  it('returns attendanceRate = 0 when attended=0 and totalSessions=5', async () => {
    const client = makeSupabase({ totalSessions: 5, attended: 0 })
    const service = new ReportService(client)

    const result = await service.getStudentAnalytics('student-1', 'class-1')

    expect(result.totalSessions).toBe(5)
    expect(result.attended).toBe(0)
    expect(result.attendanceRate).toBe(0)
  })

  it('returns attendanceRate = 1 when attended=5 and totalSessions=5', async () => {
    const client = makeSupabase({ totalSessions: 5, attended: 5 })
    const service = new ReportService(client)

    const result = await service.getStudentAnalytics('student-1', 'class-1')

    expect(result.totalSessions).toBe(5)
    expect(result.attended).toBe(5)
    expect(result.attendanceRate).toBe(1)
  })

  it('returns attendanceRate = 0 when totalSessions=0 (division by zero guard)', async () => {
    const client = makeSupabase({ totalSessions: 0, attended: 0 })
    const service = new ReportService(client)

    const result = await service.getStudentAnalytics('student-1', 'class-1')

    expect(result.totalSessions).toBe(0)
    expect(result.attended).toBe(0)
    expect(result.attendanceRate).toBe(0)
  })

  it('handles null counts from supabase by treating them as 0', async () => {
    const client = makeSupabase({ totalSessions: null, attended: null })
    const service = new ReportService(client)

    const result = await service.getStudentAnalytics('student-1', 'class-1')

    expect(result.totalSessions).toBe(0)
    expect(result.attended).toBe(0)
    expect(result.attendanceRate).toBe(0)
  })

  it('returns recentLogs from the attendance_logs data query', async () => {
    const logs = [
      { id: 'log-1', student_id: 'student-1', class_id: 'class-1', signed_at: '2024-01-01T10:00:00Z' },
    ]
    const client = makeSupabase({ totalSessions: 3, attended: 1, recentLogs: logs })
    const service = new ReportService(client)

    const result = await service.getStudentAnalytics('student-1', 'class-1')

    expect(result.recentLogs).toEqual(logs)
  })
})
