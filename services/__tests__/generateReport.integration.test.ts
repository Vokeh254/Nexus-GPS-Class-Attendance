/**
 * Integration Tests: generate-report Edge Function
 *
 * Tests exercise the core report generation logic with a mocked DB layer,
 * mirroring the same pattern used for verify-attendance integration tests.
 *
 * Scenarios covered:
 *  ✓ Known enrollment + attendance data → correct total_present and attendanceRate
 *  ✓ Idempotence: calling twice returns same report, no duplicate DB row
 *  ✓ Instructor-only access: student JWT returns 403
 *  ✓ Instructor does not own class → 403
 *  ✓ No enrolled students → attendanceRate = 0
 *  ✓ All students present → attendanceRate = 1
 *  ✓ Partial attendance → correct fractional rate
 *
 * Requirements: 7.3, 7.4, 7.6
 */

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

type ReportResult =
  | { success: true; data: ClassReport; existing: boolean }
  | { success: false; error: string }

interface EnrolledStudent {
  id: string
  full_name: string
}

interface AttendanceLogRow {
  student_id: string
  signed_at: string
}

interface ExistingReport {
  session_id: string
  generated_at: string
  total_enrolled: number
  total_present: number
  summary: { students: StudentSummary[] }
  report_url?: string
}

interface InsertedReport {
  id: string
  generated_at: string
}

// ── Core report generation logic (extracted from Edge Function) ───────────────

/**
 * Pure report generation pipeline — identical logic to the Edge Function,
 * with the DB client injected for mocking.
 */
async function runGenerateReport(opts: {
  callerId: string | null          // null → simulates invalid JWT
  callerRole: 'student' | 'instructor' | null
  classOwnerId: string
  classId: string
  sessionId: string
  db: {
    getExistingReport(sessionId: string): Promise<ExistingReport | null>
    getEnrolledStudents(classId: string): Promise<EnrolledStudent[]>
    getAttendanceLogs(sessionId: string): Promise<AttendanceLogRow[]>
    insertReport(row: object): Promise<InsertedReport | null>
  }
}): Promise<{ status: number; body: ReportResult }> {
  const { callerId, callerRole, classOwnerId, classId, sessionId, db } = opts

  // Step 1: Auth check
  if (!callerId) {
    return { status: 401, body: { success: false, error: 'Invalid or expired token' } }
  }

  // Step 2: Role check
  if (callerRole !== 'instructor') {
    return { status: 403, body: { success: false, error: 'Forbidden: instructor role required' } }
  }

  // Step 3: Ownership check
  if (classOwnerId !== callerId) {
    return { status: 403, body: { success: false, error: 'Forbidden: you do not own this class' } }
  }

  // Step 4: Idempotency — return existing report if found
  const existing = await db.getExistingReport(sessionId)
  if (existing) {
    const report: ClassReport = {
      sessionId: existing.session_id,
      date: existing.generated_at,
      totalEnrolled: existing.total_enrolled,
      totalPresent: existing.total_present,
      attendanceRate: existing.total_enrolled > 0
        ? existing.total_present / existing.total_enrolled
        : 0,
      students: existing.summary?.students ?? [],
      reportUrl: existing.report_url,
    }
    return { status: 200, body: { success: true, data: report, existing: true } }
  }

  // Step 5: Fetch enrolled students
  const enrolled = await db.getEnrolledStudents(classId)

  // Step 6: Fetch verified attendance logs
  const logs = await db.getAttendanceLogs(sessionId)

  // Step 7: Build per-student summary
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

  // Step 8: Compute totals
  const totalEnrolled = enrolled.length
  const totalPresent = students.filter((s) => s.present).length
  const attendanceRate = totalEnrolled > 0 ? totalPresent / totalEnrolled : 0

  // Step 9: Insert report
  const inserted = await db.insertReport({
    session_id: sessionId,
    class_id: classId,
    total_enrolled: totalEnrolled,
    total_present: totalPresent,
    summary: { students },
  })

  if (!inserted) {
    return { status: 500, body: { success: false, error: 'Failed to save report' } }
  }

  const report: ClassReport = {
    sessionId,
    date: inserted.generated_at,
    totalEnrolled,
    totalPresent,
    attendanceRate,
    students,
  }

  return { status: 200, body: { success: true, data: report, existing: false } }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const INSTRUCTOR_ID = 'instructor-uuid-001'
const STUDENT_A_ID = 'student-uuid-001'
const STUDENT_B_ID = 'student-uuid-002'
const STUDENT_C_ID = 'student-uuid-003'
const CLASS_ID = 'class-uuid-001'
const SESSION_ID = 'session-uuid-001'

const ENROLLED_3: EnrolledStudent[] = [
  { id: STUDENT_A_ID, full_name: 'Alice' },
  { id: STUDENT_B_ID, full_name: 'Bob' },
  { id: STUDENT_C_ID, full_name: 'Carol' },
]

const NOW = new Date().toISOString()

const INSERTED_REPORT: InsertedReport = { id: 'report-uuid-001', generated_at: NOW }

/** Builds a default mock DB for the happy path (all 3 students enrolled, 2 present) */
function makeDb(overrides: Partial<{
  existingReport: ExistingReport | null
  enrolled: EnrolledStudent[]
  logs: AttendanceLogRow[]
  inserted: InsertedReport | null
}> = {}): Parameters<typeof runGenerateReport>[0]['db'] {
  const defaultLogs: AttendanceLogRow[] = [
    { student_id: STUDENT_A_ID, signed_at: NOW },
    { student_id: STUDENT_B_ID, signed_at: NOW },
  ]

  return {
    getExistingReport: jest.fn().mockResolvedValue(
      overrides.existingReport !== undefined ? overrides.existingReport : null,
    ),
    getEnrolledStudents: jest.fn().mockResolvedValue(
      overrides.enrolled !== undefined ? overrides.enrolled : ENROLLED_3,
    ),
    getAttendanceLogs: jest.fn().mockResolvedValue(
      overrides.logs !== undefined ? overrides.logs : defaultLogs,
    ),
    insertReport: jest.fn().mockResolvedValue(
      overrides.inserted !== undefined ? overrides.inserted : INSERTED_REPORT,
    ),
  }
}

/** Shared happy-path opts */
function makeOpts(dbOverrides = {}, optsOverrides: Partial<Parameters<typeof runGenerateReport>[0]> = {}) {
  return {
    callerId: INSTRUCTOR_ID,
    callerRole: 'instructor' as const,
    classOwnerId: INSTRUCTOR_ID,
    classId: CLASS_ID,
    sessionId: SESSION_ID,
    db: makeDb(dbOverrides),
    ...optsOverrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('generate-report Edge Function – integration scenarios', () => {

  // ── Correct totals ─────────────────────────────────────────────────────────

  describe('known enrollment + attendance data', () => {
    it('returns correct total_present (2 of 3 students present)', async () => {
      const result = await runGenerateReport(makeOpts())

      expect(result.status).toBe(200)
      expect(result.body).toMatchObject({ success: true })
      const body = result.body as { success: true; data: ClassReport }
      expect(body.data.totalEnrolled).toBe(3)
      expect(body.data.totalPresent).toBe(2)
    })

    it('returns correct attendanceRate (2/3 ≈ 0.667)', async () => {
      const result = await runGenerateReport(makeOpts())

      const body = result.body as { success: true; data: ClassReport }
      expect(body.data.attendanceRate).toBeCloseTo(2 / 3, 10)
    })

    it('marks present students correctly in the summary', async () => {
      const result = await runGenerateReport(makeOpts())

      const body = result.body as { success: true; data: ClassReport }
      const alice = body.data.students.find((s) => s.studentId === STUDENT_A_ID)
      const carol = body.data.students.find((s) => s.studentId === STUDENT_C_ID)

      expect(alice?.present).toBe(true)
      expect(alice?.timestamp).toBeDefined()
      expect(carol?.present).toBe(false)
      expect(carol?.timestamp).toBeUndefined()
    })

    it('includes all enrolled students in the summary', async () => {
      const result = await runGenerateReport(makeOpts())

      const body = result.body as { success: true; data: ClassReport }
      expect(body.data.students).toHaveLength(3)
      const ids = body.data.students.map((s) => s.studentId)
      expect(ids).toContain(STUDENT_A_ID)
      expect(ids).toContain(STUDENT_B_ID)
      expect(ids).toContain(STUDENT_C_ID)
    })

    it('all students present → attendanceRate = 1', async () => {
      const allPresentLogs: AttendanceLogRow[] = ENROLLED_3.map((s) => ({
        student_id: s.id,
        signed_at: NOW,
      }))
      const result = await runGenerateReport(makeOpts({ logs: allPresentLogs }))

      const body = result.body as { success: true; data: ClassReport }
      expect(body.data.totalPresent).toBe(3)
      expect(body.data.attendanceRate).toBe(1)
    })

    it('no students present → attendanceRate = 0', async () => {
      const result = await runGenerateReport(makeOpts({ logs: [] }))

      const body = result.body as { success: true; data: ClassReport }
      expect(body.data.totalPresent).toBe(0)
      expect(body.data.attendanceRate).toBe(0)
    })

    it('no enrolled students → attendanceRate = 0 (avoid division by zero)', async () => {
      const result = await runGenerateReport(makeOpts({ enrolled: [], logs: [] }))

      const body = result.body as { success: true; data: ClassReport }
      expect(body.data.totalEnrolled).toBe(0)
      expect(body.data.attendanceRate).toBe(0)
    })
  })

  // ── Idempotence ────────────────────────────────────────────────────────────

  describe('idempotence', () => {
    it('returns existing report on second call without calling insertReport', async () => {
      const existingReport: ExistingReport = {
        session_id: SESSION_ID,
        generated_at: NOW,
        total_enrolled: 3,
        total_present: 2,
        summary: {
          students: [
            { studentId: STUDENT_A_ID, name: 'Alice', present: true, timestamp: NOW },
            { studentId: STUDENT_B_ID, name: 'Bob', present: true, timestamp: NOW },
            { studentId: STUDENT_C_ID, name: 'Carol', present: false },
          ],
        },
      }

      const db = makeDb({ existingReport })
      const result = await runGenerateReport(makeOpts({}, { db }))

      expect(result.status).toBe(200)
      const body = result.body as { success: true; data: ClassReport; existing: boolean }
      expect(body.existing).toBe(true)
      expect(body.data.totalPresent).toBe(2)
      expect(body.data.totalEnrolled).toBe(3)

      // Must NOT insert a new row
      expect(db.insertReport).not.toHaveBeenCalled()
    })

    it('existing report has same data as original', async () => {
      const existingReport: ExistingReport = {
        session_id: SESSION_ID,
        generated_at: NOW,
        total_enrolled: 3,
        total_present: 2,
        summary: { students: [] },
      }

      const db = makeDb({ existingReport })
      const result = await runGenerateReport(makeOpts({}, { db }))

      const body = result.body as { success: true; data: ClassReport }
      expect(body.data.sessionId).toBe(SESSION_ID)
      expect(body.data.totalEnrolled).toBe(3)
      expect(body.data.totalPresent).toBe(2)
      expect(body.data.attendanceRate).toBeCloseTo(2 / 3, 10)
    })
  })

  // ── Instructor-only access ─────────────────────────────────────────────────

  describe('instructor-only access', () => {
    it('returns 403 when caller has role = student', async () => {
      const result = await runGenerateReport(
        makeOpts({}, { callerRole: 'student', callerId: STUDENT_A_ID }),
      )

      expect(result.status).toBe(403)
      expect(result.body).toMatchObject({ success: false, error: expect.stringContaining('instructor') })
    })

    it('returns 403 when instructor does not own the class', async () => {
      const result = await runGenerateReport(
        makeOpts({}, { classOwnerId: 'other-instructor-uuid' }),
      )

      expect(result.status).toBe(403)
      expect(result.body).toMatchObject({ success: false, error: expect.stringContaining('own') })
    })

    it('returns 401 when JWT is invalid (callerId is null)', async () => {
      const result = await runGenerateReport(
        makeOpts({}, { callerId: null }),
      )

      expect(result.status).toBe(401)
      expect(result.body).toMatchObject({ success: false, error: expect.stringContaining('Invalid') })
    })

    it('does not query DB at all when JWT is invalid', async () => {
      const db = makeDb()
      await runGenerateReport(makeOpts({}, { callerId: null, db }))

      expect(db.getExistingReport).not.toHaveBeenCalled()
      expect(db.getEnrolledStudents).not.toHaveBeenCalled()
      expect(db.getAttendanceLogs).not.toHaveBeenCalled()
      expect(db.insertReport).not.toHaveBeenCalled()
    })
  })

  // ── Report structure ───────────────────────────────────────────────────────

  describe('report structure', () => {
    it('insertReport is called with correct fields', async () => {
      const db = makeDb()
      await runGenerateReport(makeOpts({}, { db }))

      expect(db.insertReport).toHaveBeenCalledWith(expect.objectContaining({
        session_id: SESSION_ID,
        class_id: CLASS_ID,
        total_enrolled: 3,
        total_present: 2,
        summary: expect.objectContaining({ students: expect.any(Array) }),
      }))
    })

    it('report contains sessionId matching the request', async () => {
      const result = await runGenerateReport(makeOpts())

      const body = result.body as { success: true; data: ClassReport }
      expect(body.data.sessionId).toBe(SESSION_ID)
    })
  })
})
