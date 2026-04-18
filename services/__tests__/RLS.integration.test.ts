/**
 * Integration Tests: Row-Level Security (RLS) Policies
 *
 * These tests verify the RLS policy logic for the `attendance_logs` table
 * by simulating the Supabase client behaviour with mocks that replicate
 * what the database policies enforce server-side.
 *
 * Because a live Supabase instance is not available in CI, we mock the
 * Supabase client and simulate the filtering / rejection that each RLS
 * policy would apply. The mock pattern mirrors verifyAttendance.integration.test.ts.
 *
 * Scenarios covered:
 *  ✓ Req 9.2 – Student A cannot SELECT attendance_logs belonging to Student B
 *  ✓ Req 9.1 – Student A cannot INSERT an attendance_log with Student B's student_id
 *  ✓ Req 9.3 – Instructor can SELECT attendance_logs for their own class only
 *
 * Requirements: 9.1, 9.2, 9.3
 */

// ── Types ─────────────────────────────────────────────────────────────────────

interface AttendanceLogRow {
  id: string
  session_id: string
  student_id: string
  class_id: string
  signed_at: string
  latitude: number
  longitude: number
  accuracy_m: number
  verified: boolean
}

interface RlsError {
  code: string
  message: string
  details?: string
}

type SelectResult<T> =
  | { data: T[]; error: null }
  | { data: null; error: RlsError }

type InsertResult =
  | { data: AttendanceLogRow; error: null }
  | { data: null; error: RlsError }

// ── RLS simulation helpers ────────────────────────────────────────────────────

/**
 * Simulates the `attendance_logs_select_student` RLS policy:
 *   USING (student_id = auth.uid())
 *
 * Returns only rows where student_id matches the authenticated user.
 */
function rlsStudentSelect(
  rows: AttendanceLogRow[],
  authUid: string,
): SelectResult<AttendanceLogRow> {
  const filtered = rows.filter((r) => r.student_id === authUid)
  return { data: filtered, error: null }
}

/**
 * Simulates the `attendance_logs_insert_own` RLS policy:
 *   WITH CHECK (student_id = auth.uid())
 *
 * Rejects the insert if student_id does not match the authenticated user.
 */
function rlsStudentInsert(
  row: Omit<AttendanceLogRow, 'id' | 'signed_at'>,
  authUid: string,
): InsertResult {
  if (row.student_id !== authUid) {
    return {
      data: null,
      error: {
        code: '42501',
        message: 'new row violates row-level security policy for table "attendance_logs"',
      },
    }
  }
  const inserted: AttendanceLogRow = {
    ...row,
    id: 'new-log-uuid',
    signed_at: new Date().toISOString(),
  }
  return { data: inserted, error: null }
}

/**
 * Simulates the `attendance_logs_select_instructor` RLS policy:
 *   USING (
 *     EXISTS (
 *       SELECT 1 FROM class_sessions cs
 *       JOIN classes c ON c.id = cs.class_id
 *       WHERE cs.id = attendance_logs.session_id
 *         AND c.instructor_id = auth.uid()
 *     )
 *   )
 *
 * Returns only rows whose session belongs to a class owned by the instructor.
 */
function rlsInstructorSelect(
  rows: AttendanceLogRow[],
  authUid: string,
  /** Map of session_id → instructor_id (derived from class_sessions JOIN classes) */
  sessionInstructorMap: Record<string, string>,
): SelectResult<AttendanceLogRow> {
  const filtered = rows.filter(
    (r) => sessionInstructorMap[r.session_id] === authUid,
  )
  return { data: filtered, error: null }
}

// ── Mock Supabase client factory ──────────────────────────────────────────────

/**
 * Builds a minimal mock of the Supabase client that simulates RLS behaviour.
 * The `authUid` represents the currently authenticated user (auth.uid()).
 */
function makeSupabaseMock(opts: {
  authUid: string
  existingRows: AttendanceLogRow[]
  sessionInstructorMap: Record<string, string>
}) {
  const { authUid, existingRows, sessionInstructorMap } = opts

  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: authUid } },
        error: null,
      }),
    },
    from: jest.fn((table: string) => {
      if (table !== 'attendance_logs') {
        throw new Error(`Unexpected table: ${table}`)
      }
      return {
        select: jest.fn().mockImplementation(() => ({
          eq: jest.fn().mockImplementation((col: string, val: string) => {
            // Simulate student-scoped SELECT (student_id = auth.uid())
            if (col === 'student_id') {
              const result = rlsStudentSelect(existingRows, authUid)
              // Further filter by the requested student_id value
              if (result.data) {
                return Promise.resolve({
                  data: result.data.filter((r) => r.student_id === val),
                  error: null,
                })
              }
              return Promise.resolve(result)
            }
            return Promise.resolve({ data: [], error: null })
          }),
          // Plain select without eq — instructor path
          then: (resolve: (v: SelectResult<AttendanceLogRow>) => void) => {
            const result = rlsInstructorSelect(
              existingRows,
              authUid,
              sessionInstructorMap,
            )
            resolve(result)
          },
        })),
        insert: jest.fn().mockImplementation((row: Omit<AttendanceLogRow, 'id' | 'signed_at'>) =>
          Promise.resolve(rlsStudentInsert(row, authUid)),
        ),
      }
    }),
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const STUDENT_A_ID = 'student-a-uuid'
const STUDENT_B_ID = 'student-b-uuid'
const INSTRUCTOR_OWN_ID = 'instructor-own-uuid'
const INSTRUCTOR_OTHER_ID = 'instructor-other-uuid'

const SESSION_OWN = 'session-own-uuid'
const SESSION_OTHER = 'session-other-uuid'

const CLASS_OWN = 'class-own-uuid'
const CLASS_OTHER = 'class-other-uuid'

/** Map: session → owning instructor */
const SESSION_INSTRUCTOR_MAP: Record<string, string> = {
  [SESSION_OWN]: INSTRUCTOR_OWN_ID,
  [SESSION_OTHER]: INSTRUCTOR_OTHER_ID,
}

/** Seed rows in the database */
const SEED_ROWS: AttendanceLogRow[] = [
  {
    id: 'log-a-001',
    session_id: SESSION_OWN,
    student_id: STUDENT_A_ID,
    class_id: CLASS_OWN,
    signed_at: '2024-01-01T10:00:00Z',
    latitude: 0,
    longitude: 0,
    accuracy_m: 10,
    verified: true,
  },
  {
    id: 'log-b-001',
    session_id: SESSION_OWN,
    student_id: STUDENT_B_ID,
    class_id: CLASS_OWN,
    signed_at: '2024-01-01T10:01:00Z',
    latitude: 0,
    longitude: 0,
    accuracy_m: 12,
    verified: true,
  },
  {
    id: 'log-b-002',
    session_id: SESSION_OTHER,
    student_id: STUDENT_B_ID,
    class_id: CLASS_OTHER,
    signed_at: '2024-01-02T10:00:00Z',
    latitude: 1,
    longitude: 1,
    accuracy_m: 8,
    verified: true,
  },
]

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RLS policy integration – attendance_logs', () => {

  // ── Req 9.2: Student SELECT isolation ─────────────────────────────────────

  describe('Req 9.2 – Student SELECT isolation', () => {
    it('Student A can SELECT their own attendance_logs', async () => {
      const db = makeSupabaseMock({
        authUid: STUDENT_A_ID,
        existingRows: SEED_ROWS,
        sessionInstructorMap: SESSION_INSTRUCTOR_MAP,
      })

      const result = await db
        .from('attendance_logs')
        .select()
        .eq('student_id', STUDENT_A_ID)

      expect(result.error).toBeNull()
      expect(result.data).toHaveLength(1)
      expect(result.data![0].student_id).toBe(STUDENT_A_ID)
      expect(result.data![0].id).toBe('log-a-001')
    })

    it('Student A cannot SELECT attendance_logs belonging to Student B', async () => {
      // Authenticated as Student A, but querying for Student B's rows.
      // RLS policy filters by auth.uid() = student_id, so Student B's rows
      // are invisible to Student A — the result is an empty set.
      const db = makeSupabaseMock({
        authUid: STUDENT_A_ID,
        existingRows: SEED_ROWS,
        sessionInstructorMap: SESSION_INSTRUCTOR_MAP,
      })

      const result = await db
        .from('attendance_logs')
        .select()
        .eq('student_id', STUDENT_B_ID)

      expect(result.error).toBeNull()
      // RLS filters out rows that don't belong to auth.uid() (STUDENT_A_ID),
      // so even though Student B has rows, Student A sees none of them.
      expect(result.data).toHaveLength(0)
    })

    it('Student B can SELECT their own attendance_logs (multiple rows)', async () => {
      const db = makeSupabaseMock({
        authUid: STUDENT_B_ID,
        existingRows: SEED_ROWS,
        sessionInstructorMap: SESSION_INSTRUCTOR_MAP,
      })

      const result = await db
        .from('attendance_logs')
        .select()
        .eq('student_id', STUDENT_B_ID)

      expect(result.error).toBeNull()
      expect(result.data).toHaveLength(2)
      result.data!.forEach((row) => {
        expect(row.student_id).toBe(STUDENT_B_ID)
      })
    })
  })

  // ── Req 9.1: Student INSERT restriction ───────────────────────────────────

  describe('Req 9.1 – Student INSERT restriction', () => {
    const validInsertPayload = {
      session_id: SESSION_OWN,
      student_id: STUDENT_A_ID,
      class_id: CLASS_OWN,
      latitude: 0,
      longitude: 0,
      accuracy_m: 10,
      verified: true,
    }

    it('Student A can INSERT an attendance_log with their own student_id', async () => {
      const db = makeSupabaseMock({
        authUid: STUDENT_A_ID,
        existingRows: [],
        sessionInstructorMap: SESSION_INSTRUCTOR_MAP,
      })

      const result = await db.from('attendance_logs').insert(validInsertPayload)

      expect(result.error).toBeNull()
      expect(result.data).not.toBeNull()
      expect(result.data!.student_id).toBe(STUDENT_A_ID)
    })

    it('Student A cannot INSERT an attendance_log with Student B\'s student_id', async () => {
      // Authenticated as Student A, but trying to insert a row with Student B's ID.
      // RLS WITH CHECK (student_id = auth.uid()) rejects this.
      const db = makeSupabaseMock({
        authUid: STUDENT_A_ID,
        existingRows: [],
        sessionInstructorMap: SESSION_INSTRUCTOR_MAP,
      })

      const spoofedPayload = {
        ...validInsertPayload,
        student_id: STUDENT_B_ID, // attempting to impersonate Student B
      }

      const result = await db.from('attendance_logs').insert(spoofedPayload)

      expect(result.data).toBeNull()
      expect(result.error).not.toBeNull()
      expect(result.error!.code).toBe('42501')
      expect(result.error!.message).toMatch(/row-level security policy/)
    })

    it('RLS error code 42501 is returned for policy violations', async () => {
      const db = makeSupabaseMock({
        authUid: STUDENT_A_ID,
        existingRows: [],
        sessionInstructorMap: SESSION_INSTRUCTOR_MAP,
      })

      const result = await db.from('attendance_logs').insert({
        ...validInsertPayload,
        student_id: 'some-other-student-uuid',
      })

      expect(result.error?.code).toBe('42501')
    })
  })

  // ── Req 9.3: Instructor SELECT scoping ────────────────────────────────────

  describe('Req 9.3 – Instructor SELECT scoping', () => {
    it('Instructor can SELECT attendance_logs for their own class sessions', async () => {
      const db = makeSupabaseMock({
        authUid: INSTRUCTOR_OWN_ID,
        existingRows: SEED_ROWS,
        sessionInstructorMap: SESSION_INSTRUCTOR_MAP,
      })

      // Instructor-level select (no student_id filter — uses the instructor policy)
      const result = await new Promise<SelectResult<AttendanceLogRow>>((resolve) => {
        db.from('attendance_logs').select().then(resolve)
      })

      expect(result.error).toBeNull()
      // Only rows from SESSION_OWN (owned by INSTRUCTOR_OWN_ID) should be visible
      expect(result.data).toHaveLength(2)
      result.data!.forEach((row) => {
        expect(SESSION_INSTRUCTOR_MAP[row.session_id]).toBe(INSTRUCTOR_OWN_ID)
      })
    })

    it('Instructor cannot SELECT attendance_logs for another instructor\'s class', async () => {
      const db = makeSupabaseMock({
        authUid: INSTRUCTOR_OWN_ID,
        existingRows: SEED_ROWS,
        sessionInstructorMap: SESSION_INSTRUCTOR_MAP,
      })

      const result = await new Promise<SelectResult<AttendanceLogRow>>((resolve) => {
        db.from('attendance_logs').select().then(resolve)
      })

      expect(result.error).toBeNull()
      // Rows from SESSION_OTHER (owned by INSTRUCTOR_OTHER_ID) must not appear
      const otherInstructorRows = result.data!.filter(
        (r) => SESSION_INSTRUCTOR_MAP[r.session_id] === INSTRUCTOR_OTHER_ID,
      )
      expect(otherInstructorRows).toHaveLength(0)
    })

    it('Other instructor sees only their own class attendance_logs', async () => {
      const db = makeSupabaseMock({
        authUid: INSTRUCTOR_OTHER_ID,
        existingRows: SEED_ROWS,
        sessionInstructorMap: SESSION_INSTRUCTOR_MAP,
      })

      const result = await new Promise<SelectResult<AttendanceLogRow>>((resolve) => {
        db.from('attendance_logs').select().then(resolve)
      })

      expect(result.error).toBeNull()
      expect(result.data).toHaveLength(1)
      expect(result.data![0].session_id).toBe(SESSION_OTHER)
      expect(result.data![0].student_id).toBe(STUDENT_B_ID)
    })

    it('Instructor with no classes sees no attendance_logs', async () => {
      const db = makeSupabaseMock({
        authUid: 'instructor-no-classes-uuid',
        existingRows: SEED_ROWS,
        sessionInstructorMap: SESSION_INSTRUCTOR_MAP,
      })

      const result = await new Promise<SelectResult<AttendanceLogRow>>((resolve) => {
        db.from('attendance_logs').select().then(resolve)
      })

      expect(result.error).toBeNull()
      expect(result.data).toHaveLength(0)
    })
  })

  // ── Cross-role isolation ───────────────────────────────────────────────────

  describe('Cross-role isolation', () => {
    it('Student A querying as instructor sees no rows (student policy applies)', async () => {
      // A student authenticated as STUDENT_A_ID using the instructor-style select
      // The instructor RLS policy checks class ownership — a student is not an instructor,
      // so the sessionInstructorMap won't match and they see nothing.
      const db = makeSupabaseMock({
        authUid: STUDENT_A_ID,
        existingRows: SEED_ROWS,
        sessionInstructorMap: SESSION_INSTRUCTOR_MAP,
      })

      const result = await new Promise<SelectResult<AttendanceLogRow>>((resolve) => {
        db.from('attendance_logs').select().then(resolve)
      })

      expect(result.error).toBeNull()
      // STUDENT_A_ID is not in SESSION_INSTRUCTOR_MAP as an instructor value
      expect(result.data).toHaveLength(0)
    })
  })
})
