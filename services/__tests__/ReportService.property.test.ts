/**
 * Property-Based Tests for ReportService
 *
 * Property 11: Analytics Rate Consistency
 * For any StudentAnalytics object, attendanceRate === attended / totalSessions
 * for all (attended, totalSessions) pairs where 0 <= attended <= totalSessions.
 * When totalSessions === 0, attendanceRate === 0.
 *
 * **Validates: Requirements 8.2**
 */

import * as fc from 'fast-check'
import { ReportService } from '../ReportService'
import type { SupabaseClient } from '@supabase/supabase-js'

jest.mock('../../lib/supabase', () => ({
  supabase: {},
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Creates a mock Supabase client that returns the given counts for
 * class_sessions and attendance_logs queries.
 */
function makeSupabase(totalSessions: number, attended: number): SupabaseClient {
  let attendanceLogsCallCount = 0

  const makeChain = (tableName: string) => {
    if (tableName === 'class_sessions') {
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
          then: (resolve: Function) => resolve({ data: [], error: null }),
        }
        return chain
      }
    }

    const chain: any = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      limit: () => chain,
      then: (resolve: Function) => resolve({ data: null, error: null }),
    }
    return chain
  }

  return {
    from: jest.fn().mockImplementation(makeChain),
  } as unknown as SupabaseClient
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

/**
 * Generates (attended, totalSessions) pairs where 0 <= attended <= totalSessions
 * and totalSessions >= 0.
 */
const attendancePairArbitrary = fc
  .integer({ min: 0, max: 100 })
  .chain((totalSessions) =>
    fc.tuple(
      fc.integer({ min: 0, max: totalSessions }),
      fc.constant(totalSessions),
    ),
  )
  .map(([attended, totalSessions]) => ({ attended, totalSessions }))

// ── Property Tests ────────────────────────────────────────────────────────────

describe('ReportService – Property 11: Analytics Rate Consistency', () => {
  it('attendanceRate === attended / totalSessions for all valid (attended, totalSessions) pairs', async () => {
    await fc.assert(
      fc.asyncProperty(attendancePairArbitrary, async ({ attended, totalSessions }) => {
        const client = makeSupabase(totalSessions, attended)
        const service = new ReportService(client)

        const result = await service.getStudentAnalytics('student-1', 'class-1')

        const expectedRate = totalSessions === 0 ? 0 : attended / totalSessions

        expect(result.totalSessions).toBe(totalSessions)
        expect(result.attended).toBe(attended)
        expect(result.attendanceRate).toBe(expectedRate)
      }),
      { numRuns: 200 },
    )
  })
})
