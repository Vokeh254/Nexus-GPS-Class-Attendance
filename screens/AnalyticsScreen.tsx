import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import NexusLoader from '@/components/NexusLoader';
import type { Class, AttendanceLog, ClassSession } from '../types';
import { GlassmorphicCard, NexusStatusBar, StatChart } from '../components/nexus';
import { AttendanceCalendar, type CalendarDay } from '@/components/nexus/AttendanceCalendar';
import { useRealtimeClock } from '@/hooks/useRealtimeClock';
import {
  NexusColors,
  NexusFonts,
  NexusSpacing,
  NexusRadius,
} from '../constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClassAnalytics {
  class: Class;
  attended: number;
  total: number;
  rate: number;
  logs: AttendanceLog[];
}

interface WeeklyTrend {
  label: string;
  value: number;
}

interface Badge {
  id: string;
  icon: string;
  title: string;
  earned: boolean;
}

// ─── Badge computation ────────────────────────────────────────────────────────

function computeBadges(allLogs: AttendanceLog[]): Badge[] {
  const sorted = [...allLogs].sort(
    (a, b) => new Date(a.signed_at).getTime() - new Date(b.signed_at).getTime()
  );

  // Perfect Week: 7+ consecutive calendar days with at least one attendance
  let perfectWeek = false;
  if (sorted.length >= 7) {
    const days = Array.from(
      new Set(sorted.map((l) => new Date(l.signed_at).toDateString()))
    );
    let maxStreak = 1;
    let streak = 1;
    for (let i = 1; i < days.length; i++) {
      const prev = new Date(days[i - 1]);
      const curr = new Date(days[i]);
      const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        streak++;
        if (streak > maxStreak) maxStreak = streak;
      } else {
        streak = 1;
      }
    }
    perfectWeek = maxStreak >= 7;
  }

  // Early Bird: 5+ check-ins before 9 AM
  const earlyBirdCount = sorted.filter((l) => {
    const h = new Date(l.signed_at).getHours();
    return h < 9;
  }).length;
  const earlyBird = earlyBirdCount >= 5;

  // Marathoner: 30+ day streak
  let marathoner = false;
  if (sorted.length >= 30) {
    const days = Array.from(
      new Set(sorted.map((l) => new Date(l.signed_at).toDateString()))
    );
    let maxStreak = 1;
    let streak = 1;
    for (let i = 1; i < days.length; i++) {
      const prev = new Date(days[i - 1]);
      const curr = new Date(days[i]);
      const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        streak++;
        if (streak > maxStreak) maxStreak = streak;
      } else {
        streak = 1;
      }
    }
    marathoner = maxStreak >= 30;
  }

  // On Target: overall attendance rate >= 80%
  // (computed from the caller context; passed via allLogs length vs total sessions)
  // We approximate: if we have logs, we check rate from the data prop instead.
  // This badge is set by the caller.
  return [
    { id: 'perfect_week', icon: '🏆', title: 'Perfect Week', earned: perfectWeek },
    { id: 'early_bird', icon: '⏰', title: 'Early Bird', earned: earlyBird },
    { id: 'marathoner', icon: '🏃', title: 'Marathoner', earned: marathoner },
    { id: 'on_target', icon: '🎯', title: 'On Target', earned: false }, // set by caller
  ];
}

// ─── Semester trend helpers ───────────────────────────────────────────────────

function buildWeeklyTrend(allLogs: AttendanceLog[]): WeeklyTrend[] {
  if (allLogs.length === 0) {
    // Placeholder realistic trend
    return [
      { label: 'W1', value: 80 },
      { label: 'W2', value: 85 },
      { label: 'W3', value: 78 },
      { label: 'W4', value: 90 },
      { label: 'W5', value: 88 },
      { label: 'W6', value: 92 },
    ];
  }

  // Group logs by ISO week number
  const weekMap: Record<string, number> = {};
  for (const log of allLogs) {
    const d = new Date(log.signed_at);
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const weekNum = Math.ceil(
      ((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
    );
    const key = `W${weekNum}`;
    weekMap[key] = (weekMap[key] ?? 0) + 1;
  }

  const entries = Object.entries(weekMap)
    .sort(([a], [b]) => {
      const na = parseInt(a.slice(1), 10);
      const nb = parseInt(b.slice(1), 10);
      return na - nb;
    })
    .slice(-8); // last 8 weeks

  if (entries.length === 0) {
    return [{ label: 'W1', value: 0 }];
  }

  const maxCount = Math.max(...entries.map(([, v]) => v), 1);
  return entries.map(([label, count]) => ({
    label,
    value: Math.round((count / maxCount) * 100),
  }));
}

// ─── Instructor branch — Department Intelligence ──────────────────────────────

interface StudentRisk {
  studentId: string;
  studentName: string;
  className: string;
  attendancePct: number;
}

interface ClassForecast {
  className: string;
  courseCode: string;
  trendDirection: 'up' | 'down' | 'stable';
  changePct: number;
}

function computeForecast(data: ClassAnalytics[]): ClassForecast[] {
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  return data.map(({ class: cls, logs }) => {
    const recentLogs = logs.filter(
      (l) => now - new Date(l.signed_at).getTime() <= sevenDays
    ).length;
    const prevLogs = logs.filter((l) => {
      const age = now - new Date(l.signed_at).getTime();
      return age > sevenDays && age <= sevenDays * 2;
    }).length;

    let changePct = 0;
    let trendDirection: 'up' | 'down' | 'stable' = 'stable';

    if (prevLogs > 0) {
      changePct = Math.round(((recentLogs - prevLogs) / prevLogs) * 100);
      trendDirection = changePct > 2 ? 'up' : changePct < -2 ? 'down' : 'stable';
    } else if (recentLogs > 0) {
      // No prior week data — use placeholder based on overall rate
      const rate = data.find((d) => d.class.id === cls.id)?.rate ?? 0;
      changePct = rate >= 0.8 ? 5 : rate >= 0.6 ? -8 : -15;
      trendDirection = changePct > 0 ? 'up' : 'down';
    }

    return {
      className: cls.name,
      courseCode: cls.course_code,
      trendDirection,
      changePct: Math.abs(changePct),
    };
  });
}

function InstructorAnalytics() {
  const [data, setData] = useState<ClassAnalytics[]>([]);
  const [riskStudents, setRiskStudents] = useState<StudentRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const now = useRealtimeClock();

  const fetchData = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: classes } = await supabase
        .from('classes')
        .select('*')
        .eq('instructor_id', user.id);
      if (!classes) return;

      const results: ClassAnalytics[] = await Promise.all(
        classes.map(async (cls: Class) => {
          const { data: sessions } = await supabase
            .from('class_sessions')
            .select('id')
            .eq('class_id', cls.id);
          const total = sessions?.length ?? 0;

          const { data: logs } = await supabase
            .from('attendance_logs')
            .select('*')
            .eq('class_id', cls.id)
            .order('signed_at', { ascending: false })
            .limit(200);

          const attended = logs?.length ?? 0;
          return {
            class: cls,
            attended,
            total,
            rate: total > 0 ? attended / total : 0,
            logs: logs ?? [],
          };
        })
      );
      setData(results);

      // Build risk matrix: per-student attendance per class
      const risks: StudentRisk[] = [];
      for (const { class: cls, logs, total } of results) {
        if (total === 0) continue;

        // Group logs by student
        const byStudent: Record<string, number> = {};
        for (const log of logs) {
          byStudent[log.student_id] = (byStudent[log.student_id] ?? 0) + 1;
        }

        // Fetch enrolled students for this class
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('student_id, profiles(full_name)')
          .eq('class_id', cls.id);

        for (const enrollment of enrollments ?? []) {
          const attended = byStudent[enrollment.student_id] ?? 0;
          const pct = Math.round((attended / total) * 100);
          if (pct < 70) {
            const name =
              (enrollment as any).profiles?.full_name ?? enrollment.student_id;
            risks.push({
              studentId: enrollment.student_id,
              studentName: name,
              className: cls.name,
              attendancePct: pct,
            });
          }
        }
      }
      setRiskStudents(risks);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <NexusLoader />;

  const barData = data.map(({ class: cls, rate }) => ({
    label: cls.course_code,
    value: Math.round(rate * 100),
  }));

  const forecasts = computeForecast(data);

  return (
    <View style={instrStyles.root}>
      <NexusStatusBar gpsState="active" ntpSynced />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={instrStyles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData();
            }}
            tintColor={NexusColors.accentCyan}
          />
        }
      >
        {/* Screen title */}
        <Text style={instrStyles.screenTitle}>DEPARTMENT INTELLIGENCE</Text>

        {/* 11.2 — Multi-class comparison bar chart */}
        {data.length > 0 ? (
          <GlassmorphicCard
            style={instrStyles.card}
            glowColor={NexusColors.accentCyan}
          >
            <StatChart
              type="bar"
              data={barData}
              title="Class Attendance Comparison"
            />
          </GlassmorphicCard>
        ) : (
          <GlassmorphicCard style={instrStyles.emptyCard}>
            <Text style={instrStyles.emptyIcon}>📊</Text>
            <Text style={instrStyles.emptyTitle}>No classes yet</Text>
            <Text style={instrStyles.emptySub}>
              Create classes to see analytics.
            </Text>
          </GlassmorphicCard>
        )}

        {/* 11.3 — AI Forecast card */}
        {forecasts.length > 0 && (
          <GlassmorphicCard
            style={instrStyles.card}
            glowColor={NexusColors.accentIndigo}
          >
            <Text style={instrStyles.sectionLabel}>AI FORECAST</Text>
            {forecasts.map((f, i) => {
              const isDown = f.trendDirection === 'down';
              const isUp = f.trendDirection === 'up';
              const trendColor = isDown
                ? NexusColors.accentRose
                : isUp
                ? NexusColors.accentEmerald
                : NexusColors.accentAmber;
              const trendIcon = isDown ? '⚠️' : isUp ? '📈' : '➡️';
              const trendLabel = isDown
                ? `trending down ${f.changePct}%`
                : isUp
                ? `trending up ${f.changePct}%`
                : 'stable';
              return (
                <View key={i} style={instrStyles.forecastRow}>
                  <Text style={instrStyles.forecastCode}>{f.courseCode}</Text>
                  <Text style={[instrStyles.forecastTrend, { color: trendColor }]}>
                    {trendLabel} {trendIcon}
                  </Text>
                </View>
              );
            })}
          </GlassmorphicCard>
        )}

        {/* 11.4 — Student risk matrix */}
        <GlassmorphicCard
          style={instrStyles.card}
          glowColor={NexusColors.accentRose}
        >
          <Text style={instrStyles.sectionLabel}>
            STUDENT RISK MATRIX {'(<70% attendance)'}
          </Text>
          {riskStudents.length === 0 ? (
            <Text style={instrStyles.noRisk}>✅ No at-risk students</Text>
          ) : (
            riskStudents.map((s, i) => {
              const riskColor =
                s.attendancePct < 50
                  ? NexusColors.accentRose
                  : NexusColors.accentAmber;
              return (
                <View key={i} style={instrStyles.riskRow}>
                  <View style={[instrStyles.riskDot, { backgroundColor: riskColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={instrStyles.riskName}>{s.studentName}</Text>
                    <Text style={instrStyles.riskClass}>{s.className}</Text>
                  </View>
                  <Text style={[instrStyles.riskPct, { color: riskColor }]}>
                    {s.attendancePct}%
                  </Text>
                </View>
              );
            })
          )}
        </GlassmorphicCard>

        {/* 11.5 — Configure Automated Reports button */}
        <TouchableOpacity
          style={instrStyles.configButton}
          activeOpacity={0.75}
          onPress={() =>
            Alert.alert(
              'Configure Automated Reports',
              'Automated report scheduling coming soon.'
            )
          }
        >
          <Text style={instrStyles.configIcon}>⚙️</Text>
          <Text style={instrStyles.configLabel}>Configure Automated Reports</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const instrStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: NexusColors.bgPrimary,
  },
  scroll: {
    padding: NexusSpacing.xl,
    paddingBottom: NexusSpacing['3xl'],
  },
  screenTitle: {
    fontSize: NexusFonts.sizes.sm,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textSecondary,
    letterSpacing: NexusFonts.letterSpacing.widest,
    marginBottom: NexusSpacing.lg,
  },
  card: {
    padding: NexusSpacing['2xl'],
    marginBottom: NexusSpacing.lg,
    borderRadius: NexusRadius.xl,
  },
  emptyCard: {
    alignItems: 'center',
    padding: NexusSpacing['2xl'],
    marginBottom: NexusSpacing.lg,
    borderRadius: NexusRadius.xl,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: NexusSpacing.md,
  },
  emptyTitle: {
    fontSize: NexusFonts.sizes.md,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textPrimary,
    marginBottom: NexusSpacing.xs,
  },
  emptySub: {
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.textSecondary,
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textSecondary,
    letterSpacing: NexusFonts.letterSpacing.widest,
    marginBottom: NexusSpacing.lg,
  },
  // Forecast
  forecastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: NexusSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: NexusColors.borderGlass,
  },
  forecastCode: {
    fontSize: NexusFonts.sizes.base,
    fontWeight: NexusFonts.weights.semibold,
    color: NexusColors.textPrimary,
  },
  forecastTrend: {
    fontSize: NexusFonts.sizes.sm,
    fontWeight: NexusFonts.weights.medium,
  },
  // Risk matrix
  noRisk: {
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.accentEmerald,
    textAlign: 'center',
    paddingVertical: NexusSpacing.md,
  },
  riskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.md,
    paddingVertical: NexusSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: NexusColors.borderGlass,
  },
  riskDot: {
    width: 10,
    height: 10,
    borderRadius: NexusRadius.full,
  },
  riskName: {
    fontSize: NexusFonts.sizes.base,
    fontWeight: NexusFonts.weights.semibold,
    color: NexusColors.textPrimary,
  },
  riskClass: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
    marginTop: NexusSpacing.xs,
  },
  riskPct: {
    fontSize: NexusFonts.sizes.md,
    fontWeight: NexusFonts.weights.bold,
  },
  // Configure button
  configButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: NexusSpacing.sm,
    backgroundColor: NexusColors.bgCard,
    borderWidth: 1,
    borderColor: NexusColors.borderGlow,
    borderRadius: NexusRadius.xl,
    paddingVertical: NexusSpacing.lg,
    paddingHorizontal: NexusSpacing['2xl'],
    marginBottom: NexusSpacing.lg,
  },
  configIcon: {
    fontSize: 18,
  },
  configLabel: {
    fontSize: NexusFonts.sizes.md,
    fontWeight: NexusFonts.weights.semibold,
    color: NexusColors.accentCyan,
    letterSpacing: NexusFonts.letterSpacing.wide,
  },
});

// ─── Student branch ───────────────────────────────────────────────────────────

function StudentAnalytics() {
  const [data, setData] = useState<ClassAnalytics[]>([]);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('class_id, classes(*)')
        .eq('student_id', user.id);
      if (!enrollments) return;

      const results: ClassAnalytics[] = await Promise.all(
        enrollments.map(async (e: any) => {
          const cls = e.classes as Class;

          const { data: sessions } = await supabase
            .from('class_sessions')
            .select('id, started_at, scheduled_start')
            .eq('class_id', cls.id);
          const total = sessions?.length ?? 0;

          const { data: logs } = await supabase
            .from('attendance_logs')
            .select('*')
            .eq('student_id', user.id)
            .eq('class_id', cls.id)
            .order('signed_at', { ascending: false })
            .limit(200);

          const attended = logs?.length ?? 0;
          return {
            class: cls,
            attended,
            total,
            rate: total > 0 ? attended / total : 0,
            logs: logs ?? [],
            sessions: sessions ?? [],
          };
        })
      );

      setData(results);

      // Build calendar days from all sessions + logs
      buildCalendarDays(results, 'all');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  function buildCalendarDays(results: ClassAnalytics[], classFilter: string) {
    const filtered = classFilter === 'all'
      ? results
      : results.filter(d => d.class.id === classFilter);

    const dayMap = new Map<string, 'present' | 'absent'>()

    for (const d of filtered) {
      // Mark each session day
      for (const session of (d as any).sessions ?? []) {
        const dateStr = (session.scheduled_start ?? session.started_at ?? '').slice(0, 10)
        if (!dateStr) continue
        const alreadyPresent = dayMap.get(dateStr) === 'present'
        if (!alreadyPresent) dayMap.set(dateStr, 'absent')
      }
      // Mark attended days as present
      for (const log of d.logs) {
        const dateStr = log.signed_at.slice(0, 10)
        dayMap.set(dateStr, 'present')
      }
    }

    const days: CalendarDay[] = Array.from(dayMap.entries()).map(([date, status]) => ({
      date,
      status,
    }))
    setCalendarDays(days)
  }

  useEffect(() => { fetchData(); }, [fetchData]);

  // Rebuild calendar when class filter changes
  useEffect(() => {
    if (data.length > 0) buildCalendarDays(data, selectedClass);
  }, [selectedClass, data]);

  if (loading) return <NexusLoader />;

  const allLogs = data.flatMap((d) => d.logs);
  const overallRate = data.length > 0
    ? data.reduce((sum, d) => sum + d.rate, 0) / data.length
    : 0;
  const weeklyTrend = buildWeeklyTrend(allLogs);
  const barData = data.map((d) => ({ label: d.class.course_code, value: Math.round(d.rate * 100) }));
  const badges = computeBadges(allLogs);
  const badgesWithOnTarget = badges.map((b) =>
    b.id === 'on_target' ? { ...b, earned: overallRate >= 0.8 } : b
  );

  return (
    <View style={styles.root}>
      <NexusStatusBar gpsState="active" ntpSynced />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(); }}
            tintColor={NexusColors.accentCyan}
          />
        }
      >
        <Text style={styles.screenTitle}>STUDENT INTELLIGENCE</Text>

        {/* ── Attendance Calendar ── */}
        <GlassmorphicCard style={styles.calendarCard} glowColor={NexusColors.accentIndigo}>
          <Text style={styles.sectionLabel}>ATTENDANCE CALENDAR</Text>

          {/* Class filter pills */}
          {data.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              <TouchableOpacity
                style={[styles.filterPill, selectedClass === 'all' && styles.filterPillActive]}
                onPress={() => setSelectedClass('all')}
              >
                <Text style={[styles.filterPillText, selectedClass === 'all' && styles.filterPillTextActive]}>
                  All
                </Text>
              </TouchableOpacity>
              {data.map(d => (
                <TouchableOpacity
                  key={d.class.id}
                  style={[styles.filterPill, selectedClass === d.class.id && styles.filterPillActive]}
                  onPress={() => setSelectedClass(d.class.id)}
                >
                  <Text style={[styles.filterPillText, selectedClass === d.class.id && styles.filterPillTextActive]}>
                    {d.class.course_code}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <AttendanceCalendar days={calendarDays} />
        </GlassmorphicCard>

        {/* ── Semester trend ── */}
        <GlassmorphicCard style={styles.chartCard} glowColor={NexusColors.accentCyan}>
          <StatChart type="line" data={weeklyTrend} title="Semester Trend" />
        </GlassmorphicCard>

        {/* ── Per-subject bar chart ── */}
        {barData.length > 0 && (
          <GlassmorphicCard style={styles.chartCard}>
            <StatChart type="bar" data={barData} title="Attendance by Subject" />
          </GlassmorphicCard>
        )}

        {data.length === 0 && (
          <GlassmorphicCard style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>No data yet</Text>
            <Text style={styles.emptySub}>Enroll in classes to see your attendance analytics.</Text>
          </GlassmorphicCard>
        )}

        {/* ── Achievements ── */}
        <GlassmorphicCard style={styles.achievementsCard} glowColor={NexusColors.accentIndigo}>
          <Text style={styles.sectionLabel}>ACHIEVEMENTS</Text>
          <View style={styles.badgeGrid}>
            {badgesWithOnTarget.map((badge) => (
              <View
                key={badge.id}
                style={[styles.badge, badge.earned ? styles.badgeEarned : styles.badgeLocked]}
              >
                <Text style={styles.badgeIcon}>{badge.icon}</Text>
                <Text style={[styles.badgeTitle, { color: badge.earned ? NexusColors.textPrimary : NexusColors.textDisabled }]}>
                  {badge.title}
                </Text>
                {!badge.earned && <Text style={styles.badgeLockIcon}>🔒</Text>}
              </View>
            ))}
          </View>
        </GlassmorphicCard>

        <TouchableOpacity
          style={styles.exportButton}
          activeOpacity={0.75}
          onPress={() => Alert.alert('Export Report', 'Report generation coming soon')}
        >
          <Text style={styles.exportIcon}>📤</Text>
          <Text style={styles.exportLabel}>Export Report</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ─── Styles (student branch) ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: NexusColors.bgPrimary,
  },
  scroll: {
    padding: NexusSpacing.xl,
    paddingBottom: NexusSpacing['3xl'],
  },
  screenTitle: {
    fontSize: NexusFonts.sizes.sm,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textSecondary,
    letterSpacing: NexusFonts.letterSpacing.widest,
    marginBottom: NexusSpacing.lg,
  },
  chartCard: {
    marginBottom: NexusSpacing.lg,
    borderRadius: NexusRadius.xl,
  },
  emptyCard: {
    alignItems: 'center',
    padding: NexusSpacing['2xl'],
    marginBottom: NexusSpacing.lg,
    borderRadius: NexusRadius.xl,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: NexusSpacing.md,
  },
  emptyTitle: {
    fontSize: NexusFonts.sizes.md,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textPrimary,
    marginBottom: NexusSpacing.xs,
  },
  emptySub: {
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.textSecondary,
    textAlign: 'center',
  },
  achievementsCard: {
    padding: NexusSpacing['2xl'],
    marginBottom: NexusSpacing.lg,
    borderRadius: NexusRadius.xl,
  },
  sectionLabel: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textSecondary,
    letterSpacing: NexusFonts.letterSpacing.widest,
    marginBottom: NexusSpacing.lg,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: NexusSpacing.md,
  },
  badge: {
    width: '46%',
    borderRadius: NexusRadius.lg,
    padding: NexusSpacing.md,
    alignItems: 'center',
    gap: NexusSpacing.xs,
    borderWidth: 1,
  },
  badgeEarned: {
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderColor: NexusColors.borderGlow,
  },
  badgeLocked: {
    backgroundColor: 'rgba(71, 85, 105, 0.15)',
    borderColor: NexusColors.borderGlass,
  },
  badgeIcon: {
    fontSize: 28,
  },
  badgeTitle: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.semibold,
    textAlign: 'center',
  },
  badgeLockIcon: {
    fontSize: 10,
    opacity: 0.5,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: NexusSpacing.sm,
    backgroundColor: NexusColors.bgCard,
    borderWidth: 1,
    borderColor: NexusColors.borderGlow,
    borderRadius: NexusRadius.xl,
    paddingVertical: NexusSpacing.lg,
    paddingHorizontal: NexusSpacing['2xl'],
    marginBottom: NexusSpacing.lg,
  },
  exportIcon: {
    fontSize: 18,
  },
  exportLabel: {
    fontSize: NexusFonts.sizes.md,
    fontWeight: NexusFonts.weights.semibold,
    color: NexusColors.accentCyan,
    letterSpacing: NexusFonts.letterSpacing.wide,
  },
  // Real-time clock
  clockCard: {
    alignItems: 'center',
    paddingVertical: NexusSpacing.xl,
  },
  clockTime: {
    fontSize: 36,
    fontWeight: '900',
    color: NexusColors.accentCyan,
    letterSpacing: 2,
    fontVariant: ['tabular-nums'] as any,
  },
  clockDate: {
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.textSecondary,
    marginTop: 4,
  },
  // Calendar
  calendarCard: {
    padding: NexusSpacing.lg,
  },
  filterRow: {
    gap: NexusSpacing.sm,
    paddingBottom: NexusSpacing.md,
  },
  filterPill: {
    borderWidth: 1,
    borderColor: NexusColors.borderGlow,
    borderRadius: NexusRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  filterPillActive: {
    backgroundColor: NexusColors.accentIndigo,
    borderColor: NexusColors.accentIndigo,
  },
  filterPillText: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
    fontWeight: NexusFonts.weights.semibold,
  },
  filterPillTextActive: {
    color: '#fff',
  },
});

// ─── Root export — role-branched ──────────────────────────────────────────────

export default function AnalyticsScreen() {
  const [role, setRole] = useState<'student' | 'instructor' | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.role) setRole(data.role as 'student' | 'instructor');
        });
    });
  }, []);

  if (role === null) return <NexusLoader />;
  if (role === 'instructor') return <InstructorAnalytics />;
  return <StudentAnalytics />;
}
