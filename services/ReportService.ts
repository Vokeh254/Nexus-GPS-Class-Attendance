import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { ReportResult, StudentAnalytics, ClassReport, AttendanceLog } from '../types'

export class ReportService {
  constructor(private supabaseClient: SupabaseClient) {}

  async generateReport(classId: string, sessionId: string): Promise<ReportResult> {
    try {
      const { data, error } = await this.supabaseClient.functions.invoke('generate-report', {
        body: { class_id: classId, session_id: sessionId },
      })

      if (error) {
        return { success: false, error: error.message ?? 'Failed to generate report' }
      }

      return { success: true, data: data as ClassReport }
    } catch (err: any) {
      return { success: false, error: err?.message ?? 'Unknown error' }
    }
  }

  async getStudentAnalytics(studentId: string, classId: string): Promise<StudentAnalytics> {
    // Count total sessions for the class
    const { count: totalSessions } = await this.supabaseClient
      .from('class_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('class_id', classId)

    // Count sessions the student attended
    const { count: attended } = await this.supabaseClient
      .from('attendance_logs')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('class_id', classId)

    const total = totalSessions ?? 0
    const present = attended ?? 0
    const attendanceRate = total === 0 ? 0 : present / total

    // Fetch recent logs
    const { data: recentData } = await this.supabaseClient
      .from('attendance_logs')
      .select('*')
      .eq('student_id', studentId)
      .eq('class_id', classId)
      .order('signed_at', { ascending: false })
      .limit(10)

    return {
      totalSessions: total,
      attended: present,
      attendanceRate,
      recentLogs: (recentData ?? []) as AttendanceLog[],
    }
  }

  async getClassReport(sessionId: string): Promise<ClassReport> {
    const { data, error } = await this.supabaseClient
      .from('reports')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    if (error || !data) {
      throw new Error(`Report not found for session: ${sessionId}`)
    }

    return {
      sessionId: data.session_id,
      date: data.generated_at,
      totalEnrolled: data.total_enrolled,
      totalPresent: data.total_present,
      attendanceRate: data.total_enrolled > 0 ? data.total_present / data.total_enrolled : 0,
      students: data.summary?.students ?? [],
      reportUrl: data.report_url,
    }
  }
}

export default new ReportService(supabase)
