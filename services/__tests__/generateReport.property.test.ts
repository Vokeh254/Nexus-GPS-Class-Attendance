/**
 * Property-Based Tests: generate-report Edge Function
 *
 * Property 5: Report Consistency
 * For any generated report, total_present SHALL equal the count of verified
 * attendance_logs for the same session_id.
 * Validates: Requirements 7.3, 7.4
 *
 * Property 10: Report Idempotence
 * For any session with an existing report, calling generateReport again SHALL
 * return the same report without inserting a duplicate row.
 * Validates: Requirements 7.6
 */

import * as fc from 'fast-check'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StudentSummary {
  studentId: string
  name: string
  present: boolean
  timestamp?: string
}

interface ClassReport {
  sessionId: string
  date: string
  totalEnrolled: number
  totalPresent: number
  attendanceRate: number
  students: StudentSummary[]
  reportUrl?: string
}

interface EnrolledStudent {
  id: string
  full_name: string
}

interface AttendanceLogRow {
  student_id: string
  signed_at: string
}

// ── Report generation logic (pure, extracted from Edge Function) ──────────────

/**
 * Builds a ClassReport from enrolled students and attendance logs.
 * This is the pure computation extracted from the Edge Function — no I/O.
 */
function buildReport(
  sessionId: string,
  classId: string,
  enrolled: EnrolledStudent[],
  logs: AttendanceLogRow[],
  generatedAt: string,
): ClassReport {
  const presentMap = new Map<string, string>()
  for (const log of logs) {
    presentMap.set(log.student_id, log.signed_at)
  }

  const students: StudentSummary[] = enrolled.map((student) => {
    const present = presentMap.has(student.id)
    return {
      studentId: student.id,
      name: student.full_name,
      present,
      timestamp: present ? presentMap.get(student.id) : undefined,
    }
  })

  const totalEnrolled = enrolled.length
  const totalPresent = students.filter((s) => s.present).length
  const attendanceRate = totalEnrolled > 0 ? totalPresent / totalEnrolled : 0

  return {
    sessionId,
    date: generatedAt,
    totalEnrolled,
    totalPresent,
    attendanceRate,
    students,
  }
}

/**
 * In-memory report store — simulates the reports table with idempotency.
 * Returns { report, wasExisting } so tests can assert on both paths.
 */
function makeReportStore() {
  const reports = new Map<string, ClassReport>()

  return {
    generateOrReturn(
      sessionId: string,
      classId: string,
      enrolled: EnrolledStudent[],
      logs: AttendanceLogRow[],
    ): { report: ClassReport; wasExisting: boolean } {
      if (reports.has(sessionId)) {
        return { report: reports.get(sessionId)!, wasExisting: true }
      }

      const report = buildReport(sessionId, classId, enrolled, logs, new Date().toISOString())
      reports.set(sessionId, report)
      return { report, wasExisting: false }
    },

    countReportsFor(sessionId: string): number {
      return reports.has(sessionId) ? 1 : 0
    },
  }
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Generates a list of unique student IDs (1–20 students) */
const enrolledStudentsArb = fc
  .uniqueArray(fc.uuid(), { minLength: 1, maxLength: 20 })
  .map((ids) =>
    ids.map((id, i) => ({ id, full_name: `Student ${i + 1}` })),
  )

/**
 * Given a list of enrolled students, generates a subset of them as present
 * (0 to all students may be present).
 */
function attendanceLogsArb(enrolled: EnrolledStudent[]): fc.Arbitrary<AttendanceLogRow[]> {
  if (enrolled.length === 0) return fc.constant([])

  return fc
    .subarray(enrolled, { minLength: 0, maxLength: enrolled.length })
    .map((presentStudents) =>
      presentStudents.map((s) => ({
        student_id: s.id,
        signed_at: new Date().toISOString(),
      })),
    )
}

/** Combined arbitrary: enrolled students + a subset of them as present */
const enrolledWithLogsArb = enrolledStudentsArb.chain((enrolled) =>
  attendanceLogsArb(enrolled).map((logs) => ({ enrolled, logs })),
)

// ── Property 5: Report Consistency ───────────────────────────────────────────

describe('Property 5: Report Consistency', () => {
  it('total_present equals the count of verified attendance_logs for the session', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        enrolledWithLogsArb,
        (sessionId, classId, { enrolled, logs }) => {
          const report = buildReport(sessionId, classId, enrolled, logs, new Date().toISOString())

          // INVARIANT: total_present === count of verified logs
          expect(report.totalPresent).toBe(logs.length)
        },
      ),
      { numRuns: 500 },
    )
  })

  it('total_present equals count of present:true entries in the students summary', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        enrolledWithLogsArb,
        (sessionId, classId, { enrolled, logs }) => {
          const report = buildReport(sessionId, classId, enrolled, logs, new Date().toISOString())

          const presentCount = report.students.filter((s) => s.present).length

          // INVARIANT: total_present is consistent with the summary array
          expect(report.totalPresent).toBe(presentCount)
        },
      ),
      { numRuns: 500 },
    )
  })

  it('attendanceRate = total_present / total_enrolled for all non-empty enrollments', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        enrolledWithLogsArb,
        (sessionId, classId, { enrolled, logs }) => {
          const report = buildReport(sessionId, classId, enrolled, logs, new Date().toISOString())

          if (report.totalEnrolled > 0) {
            // INVARIANT: attendanceRate is the exact ratio
            expect(report.attendanceRate).toBeCloseTo(
              report.totalPresent / report.totalEnrolled,
              10,
            )
          }
        },
      ),
      { numRuns: 500 },
    )
  })

  it('total_present is always between 0 and total_enrolled (inclusive)', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        enrolledWithLogsArb,
        (sessionId, classId, { enrolled, logs }) => {
          const report = buildReport(sessionId, classId, enrolled, logs, new Date().toISOString())

          // INVARIANT: present count is bounded by enrollment count
          expect(report.totalPresent).toBeGreaterThanOrEqual(0)
          expect(report.totalPresent).toBeLessThanOrEqual(report.totalEnrolled)
        },
      ),
      { numRuns: 500 },
    )
  })

  it('students not in attendance logs are marked present: false with no timestamp', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        enrolledWithLogsArb,
        (sessionId, classId, { enrolled, logs }) => {
          const report = buildReport(sessionId, classId, enrolled, logs, new Date().toISOString())

          const presentIds = new Set(logs.map((l) => l.student_id))

          for (const student of report.students) {
            if (!presentIds.has(student.studentId)) {
              // INVARIANT: absent students have present=false and no timestamp
              expect(student.present).toBe(false)
              expect(student.timestamp).toBeUndefined()
            }
          }
        },
      ),
      { numRuns: 500 },
    )
  })

  it('students in attendance logs are marked present: true with a timestamp', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        enrolledWithLogsArb,
        (sessionId, classId, { enrolled, logs }) => {
          const report = buildReport(sessionId, classId, enrolled, logs, new Date().toISOString())

          const presentIds = new Set(logs.map((l) => l.student_id))

          for (const student of report.students) {
            if (presentIds.has(student.studentId)) {
              // INVARIANT: present students have present=true and a timestamp
              expect(student.present).toBe(true)
              expect(student.timestamp).toBeDefined()
            }
          }
        },
      ),
      { numRuns: 500 },
    )
  })
})

// ── Property 10: Report Idempotence ──────────────────────────────────────────

describe('Property 10: Report Idempotence', () => {
  it('calling generateReport twice for the same session returns the same report', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        enrolledWithLogsArb,
        (sessionId, classId, { enrolled, logs }) => {
          const store = makeReportStore()

          const first = store.generateOrReturn(sessionId, classId, enrolled, logs)
          const second = store.generateOrReturn(sessionId, classId, enrolled, logs)

          // INVARIANT: second call returns the same report
          expect(second.report).toEqual(first.report)
          expect(second.wasExisting).toBe(true)
        },
      ),
      { numRuns: 300 },
    )
  })

  it('count of reports for a session never exceeds 1 regardless of call count', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        enrolledWithLogsArb,
        fc.integer({ min: 1, max: 10 }),
        (sessionId, classId, { enrolled, logs }, callCount) => {
          const store = makeReportStore()

          for (let i = 0; i < callCount; i++) {
            store.generateOrReturn(sessionId, classId, enrolled, logs)
          }

          // INVARIANT: at most one report per session
          expect(store.countReportsFor(sessionId)).toBe(1)
        },
      ),
      { numRuns: 300 },
    )
  })

  it('first call creates a new report (wasExisting = false)', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        enrolledWithLogsArb,
        (sessionId, classId, { enrolled, logs }) => {
          const store = makeReportStore()

          const result = store.generateOrReturn(sessionId, classId, enrolled, logs)

          // INVARIANT: first call always creates a new report
          expect(result.wasExisting).toBe(false)
        },
      ),
      { numRuns: 300 },
    )
  })

  it('different sessions each get their own independent report', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        enrolledWithLogsArb,
        enrolledWithLogsArb,
        (sessionA, sessionB, classIdA, classIdB, pairA, pairB) => {
          fc.pre(sessionA !== sessionB)

          const store = makeReportStore()

          store.generateOrReturn(sessionA, classIdA, pairA.enrolled, pairA.logs)
          store.generateOrReturn(sessionB, classIdB, pairB.enrolled, pairB.logs)

          // INVARIANT: each session has exactly one report
          expect(store.countReportsFor(sessionA)).toBe(1)
          expect(store.countReportsFor(sessionB)).toBe(1)
        },
      ),
      { numRuns: 200 },
    )
  })

  it('idempotent result has consistent total_present regardless of call order', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        enrolledWithLogsArb,
        (sessionId, classId, { enrolled, logs }) => {
          const store = makeReportStore()

          const original = store.generateOrReturn(sessionId, classId, enrolled, logs)

          for (let i = 0; i < 5; i++) {
            const repeated = store.generateOrReturn(sessionId, classId, enrolled, logs)
            // INVARIANT: totals are stable across repeated calls
            expect(repeated.report.totalPresent).toBe(original.report.totalPresent)
            expect(repeated.report.totalEnrolled).toBe(original.report.totalEnrolled)
            expect(repeated.report.attendanceRate).toBe(original.report.attendanceRate)
          }
        },
      ),
      { numRuns: 200 },
    )
  })
})
