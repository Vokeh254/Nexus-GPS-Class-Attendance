import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Modal, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';
import ThemeToggle from '@/components/ThemeToggle';
import NexusLoader from '@/components/NexusLoader';
import AuthService from '@/services/AuthService';
import { GlassmorphicCard, NexusStatusBar } from '@/components/nexus';
import { NexusColors, NexusFonts, NexusSpacing, NexusRadius } from '@/constants/theme';
import type { Profile, AttendanceLog, Class } from '@/types';

// ─── Instructor class summary type ───────────────────────────────────────────
interface ClassSummary extends Class {
  enrollmentCount: number;
}

// ─── Static placeholder for demo ─────────────────────────────────────────────
const biometricActive = true;

const SECURITY_ITEMS = [
  { icon: '🔐', label: 'Biometric Linked', value: true },
  { icon: '📱', label: 'Device Trusted',   value: true },
  { icon: '🔑', label: '2FA Enabled',      value: true },
  { icon: '💾', label: 'Backup Codes',     value: false },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ProfileScreen() {
  const { colors, isDark } = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editStudentId, setEditStudentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<AttendanceLog[]>([]);
  // Instructor-specific state
  const [classSummaries, setClassSummaries] = useState<ClassSummary[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? '');

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single();
      if (prof) setProfile(prof);

      if (prof?.role === 'instructor') {
        // Fetch instructor's classes with enrollment counts
        const { data: classes } = await supabase
          .from('classes')
          .select('*')
          .eq('instructor_id', user.id)
          .order('created_at', { ascending: false });

        if (classes && classes.length > 0) {
          const summaries = await Promise.all(
            classes.map(async (cls: Class) => {
              const { count } = await supabase
                .from('enrollments')
                .select('*', { count: 'exact', head: true })
                .eq('class_id', cls.id);
              return { ...cls, enrollmentCount: count ?? 0 } as ClassSummary;
            })
          );
          setClassSummaries(summaries);
        } else {
          setClassSummaries([]);
        }
      } else {
        const { data: logs } = await supabase
          .from('attendance_logs')
          .select('*')
          .eq('student_id', user.id)
          .order('signed_at', { ascending: false })
          .limit(10);
        if (logs) setHistory(logs);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function saveProfile() {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.from('profiles')
      .update({ full_name: editName.trim(), student_id: editStudentId.trim() || null })
      .eq('id', profile.id);
    setSaving(false);
    if (!error) {
      setProfile((p) => p
        ? { ...p, full_name: editName.trim(), student_id: editStudentId.trim() || undefined }
        : p);
      setEditVisible(false);
    } else {
      Alert.alert('Error', 'Could not save. Please try again.');
    }
  }

  if (loading) return <NexusLoader />;

  const initials = profile?.full_name
    ?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) ?? '?';
  const isInstructor = profile?.role === 'instructor';

  // ── Instructor branch — Nexus design language ────────────────────────────
  if (isInstructor) {
    const totalEnrolled = classSummaries.reduce((sum, c) => sum + c.enrollmentCount, 0);

    return (
      <View style={ins.root}>
        <NexusStatusBar gpsState="active" ntpSynced />

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchData(); }}
              tintColor={NexusColors.accentIndigo}
            />
          }
        >
          {/* ── Avatar hero ── */}
          <View style={ins.heroSection}>
            <View style={ins.avatarOuterRing}>
              <View style={ins.avatarInner}>
                <Text style={ins.avatarInitials}>{initials}</Text>
              </View>
            </View>
            <Text style={ins.heroName}>{profile?.full_name ?? '—'}</Text>
            <Text style={ins.heroEmail}>{email}</Text>
            <View style={ins.rolePill}>
              <Text style={ins.rolePillText}>🎓 INSTRUCTOR</Text>
            </View>
          </View>

          <View style={ins.body}>
            {/* ── Class summary stats ── */}
            <Text style={ins.sectionLabel}>ADMINISTRATION OVERVIEW</Text>
            <GlassmorphicCard style={ins.statsGrid} glowColor={NexusColors.accentIndigo}>
              <View style={ins.statItem}>
                <Text style={ins.statValue}>{classSummaries.length}</Text>
                <Text style={ins.statLabel}>Classes</Text>
              </View>
              <View style={ins.statDivider} />
              <View style={ins.statItem}>
                <Text style={ins.statValue}>{totalEnrolled}</Text>
                <Text style={ins.statLabel}>Total Students</Text>
              </View>
            </GlassmorphicCard>

            {/* ── Classes list ── */}
            {classSummaries.length > 0 && (
              <>
                <Text style={ins.sectionLabel}>MY CLASSES</Text>
                <GlassmorphicCard style={ins.classesCard}>
                  {classSummaries.map((cls, i) => (
                    <View
                      key={cls.id}
                      style={[ins.classRow, i < classSummaries.length - 1 && ins.classBorder]}
                    >
                      <View style={ins.classIconWrap}>
                        <Text style={ins.classIcon}>📚</Text>
                      </View>
                      <View style={ins.classInfo}>
                        <Text style={ins.className}>{cls.name}</Text>
                        <Text style={ins.classMeta}>{cls.course_code}</Text>
                      </View>
                      <View style={ins.enrollBadge}>
                        <Text style={ins.enrollCount}>{cls.enrollmentCount}</Text>
                        <Text style={ins.enrollLabel}>enrolled</Text>
                      </View>
                    </View>
                  ))}
                </GlassmorphicCard>
              </>
            )}

            {/* ── Settings ── */}
            <Text style={ins.sectionLabel}>SETTINGS</Text>
            <GlassmorphicCard style={ins.settingsCard}>
              {[
                {
                  icon: '✏️', label: 'Edit Profile',
                  onPress: () => {
                    setEditName(profile?.full_name ?? '');
                    setEditStudentId('');
                    setEditVisible(true);
                  },
                },
                { icon: '🎨', label: 'Appearance', onPress: () => {}, hasToggle: true },
                { icon: '🔒', label: 'Privacy & Security', onPress: () => router.push('/instructor-privacy') },
                { icon: '❓', label: 'Help & Support', onPress: () => router.push('/instructor-help') },
                { icon: '📄', label: 'Terms & Privacy', onPress: () => router.push('/instructor-terms') },
              ].map((item, i, arr) => (
                <TouchableOpacity
                  key={item.label}
                  style={[ins.settingsRow, i < arr.length - 1 && ins.settingsBorder]}
                  onPress={item.hasToggle ? undefined : item.onPress}
                  activeOpacity={item.hasToggle ? 1 : 0.7}
                  disabled={item.hasToggle}
                >
                  <View style={ins.settingsIconWrap}>
                    <Text style={ins.settingsIcon}>{item.icon}</Text>
                  </View>
                  <Text style={ins.settingsLabel}>{item.label}</Text>
                  {item.hasToggle ? <ThemeToggle /> : <Text style={ins.settingsChevron}>›</Text>}
                </TouchableOpacity>
              ))}
            </GlassmorphicCard>

            {/* ── Sign out ── */}
            <TouchableOpacity
              style={ins.signOutBtn}
              onPress={async () => { await AuthService.signOut(); router.replace('/login'); }}
              activeOpacity={0.8}
            >
              <Text style={ins.signOutText}>🚪 Sign Out</Text>
            </TouchableOpacity>

            <View style={{ height: 32 }} />
          </View>
        </ScrollView>

        {/* ── Edit profile modal ── */}
        <Modal visible={editVisible} animationType="slide" transparent>
          <View style={ins.modalOverlay}>
            <View style={ins.modalCard}>
              <Text style={ins.modalTitle}>Edit Profile</Text>
              <Text style={ins.modalLabel}>Full Name</Text>
              <TextInput
                style={ins.modalInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Your full name"
                placeholderTextColor={NexusColors.textDisabled}
              />
              <View style={ins.modalActions}>
                <TouchableOpacity style={ins.modalCancel} onPress={() => setEditVisible(false)}>
                  <Text style={ins.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[ins.modalSave, saving && { opacity: 0.6 }]}
                  onPress={saveProfile}
                  disabled={saving}
                >
                  <Text style={ins.modalSaveText}>{saving ? 'Saving…' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ── Student branch — Nexus design language ────────────────────────────────
  return (
    <View style={nx.root}>
      <NexusStatusBar gpsState="active" ntpSynced />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(); }}
            tintColor={NexusColors.accentCyan}
          />
        }
      >
        {/* ── Avatar hero ── */}
        <View style={nx.heroSection}>
          {/* Outer emerald ring (biometric active) */}
          <View style={[
            nx.avatarOuterRing,
            biometricActive && { borderColor: NexusColors.accentEmerald },
          ]}>
            <View style={nx.avatarInner}>
              <Text style={nx.avatarInitials}>{initials}</Text>
            </View>
          </View>

          <Text style={nx.heroName}>{profile?.full_name ?? '—'}</Text>
          <Text style={nx.heroEmail}>{email}</Text>

          <View style={nx.rolePill}>
            <Text style={nx.rolePillText}>🎒 Student</Text>
          </View>
          {profile?.student_id && (
            <Text style={nx.studentId}>ID: {profile.student_id}</Text>
          )}
          {biometricActive && (
            <View style={nx.bioBadge}>
              <Text style={nx.bioBadgeText}>🔒 Biometric Active</Text>
            </View>
          )}
        </View>

        <View style={nx.body}>
          {/* ── Security status grid ── */}
          <Text style={nx.sectionLabel}>SECURITY STATUS</Text>
          <GlassmorphicCard style={nx.securityGrid} glowColor={NexusColors.accentCyan}>
            {SECURITY_ITEMS.map((item, i) => (
              <View
                key={item.label}
                style={[
                  nx.securityItem,
                  i % 2 === 0 && i < SECURITY_ITEMS.length - 1 && nx.securityItemBorderRight,
                  i < 2 && nx.securityItemBorderBottom,
                ]}
              >
                <Text style={nx.securityIcon}>{item.icon}</Text>
                <Text style={nx.securityLabel}>{item.label}</Text>
                <Text style={[
                  nx.securityStatus,
                  { color: item.value ? NexusColors.accentEmerald : NexusColors.accentAmber },
                ]}>
                  {item.value ? '✅' : '⚠️'}
                </Text>
              </View>
            ))}
          </GlassmorphicCard>

          {/* ── Geofence history timeline ── */}
          <Text style={nx.sectionLabel}>GEOFENCE HISTORY</Text>
          <GlassmorphicCard style={nx.timelineCard}>
            {history.length === 0 ? (
              <Text style={nx.emptyText}>No check-in history yet.</Text>
            ) : (
              history.map((log, i) => (
                <View key={log.id} style={[nx.timelineItem, i < history.length - 1 && nx.timelineBorder]}>
                  <View style={[
                    nx.timelineDot,
                    { backgroundColor: log.verified ? NexusColors.accentEmerald : NexusColors.accentAmber },
                  ]} />
                  <View style={nx.timelineContent}>
                    <Text style={nx.timelineClass}>{log.class_id}</Text>
                    <Text style={nx.timelineTime}>
                      {formatDate(log.signed_at)} · {formatTime(log.signed_at)}
                    </Text>
                  </View>
                  <Text style={[
                    nx.timelineVerified,
                    { color: log.verified ? NexusColors.accentEmerald : NexusColors.accentAmber },
                  ]}>
                    {log.verified ? '✅' : '⏳'}
                  </Text>
                </View>
              ))
            )}
          </GlassmorphicCard>

          {/* ── Settings ── */}
          <Text style={nx.sectionLabel}>SETTINGS</Text>
          <GlassmorphicCard style={nx.settingsCard}>
            {[
              {
                icon: '✏️', label: 'Edit Profile',
                onPress: () => {
                  setEditName(profile?.full_name ?? '');
                  setEditStudentId(profile?.student_id ?? '');
                  setEditVisible(true);
                },
              },
              { icon: '🏆', label: 'Achievement Gallery', onPress: () => router.push('/(tabs)/achievements') },
              { icon: '🎨', label: 'Appearance', onPress: () => {}, hasToggle: true },
              { icon: '🔒', label: 'Privacy & Security', onPress: () => router.push('/student-privacy') },
              { icon: '❓', label: 'Help & Support', onPress: () => router.push('/student-help') },
              { icon: '📄', label: 'Terms & Privacy', onPress: () => router.push('/student-terms') },
            ].map((item, i, arr) => (
              <TouchableOpacity
                key={item.label}
                style={[nx.settingsRow, i < arr.length - 1 && nx.settingsBorder]}
                onPress={item.hasToggle ? undefined : item.onPress}
                activeOpacity={item.hasToggle ? 1 : 0.7}
                disabled={item.hasToggle}
              >
                <View style={nx.settingsIconWrap}>
                  <Text style={nx.settingsIcon}>{item.icon}</Text>
                </View>
                <Text style={nx.settingsLabel}>{item.label}</Text>
                {item.hasToggle ? <ThemeToggle /> : <Text style={nx.settingsChevron}>›</Text>}
              </TouchableOpacity>
            ))}
          </GlassmorphicCard>

          {/* ── Sign out ── */}
          <TouchableOpacity
            style={nx.signOutBtn}
            onPress={async () => { await AuthService.signOut(); router.replace('/login'); }}
            activeOpacity={0.8}
          >
            <Text style={nx.signOutText}>🚪 Sign Out</Text>
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </View>
      </ScrollView>

      {/* ── Edit profile modal ── */}
      <Modal visible={editVisible} animationType="slide" transparent>
        <View style={nx.modalOverlay}>
          <View style={nx.modalCard}>
            <Text style={nx.modalTitle}>Edit Profile</Text>

            <Text style={nx.modalLabel}>Full Name</Text>
            <TextInput
              style={nx.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your full name"
              placeholderTextColor={NexusColors.textDisabled}
            />

            <Text style={nx.modalLabel}>Student ID</Text>
            <TextInput
              style={nx.modalInput}
              value={editStudentId}
              onChangeText={setEditStudentId}
              placeholder="Institutional ID (optional)"
              placeholderTextColor={NexusColors.textDisabled}
            />

            <View style={nx.modalActions}>
              <TouchableOpacity style={nx.modalCancel} onPress={() => setEditVisible(false)}>
                <Text style={nx.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[nx.modalSave, saving && { opacity: 0.6 }]}
                onPress={saveProfile}
                disabled={saving}
              >
                <Text style={nx.modalSaveText}>{saving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Nexus student styles ─────────────────────────────────────────────────────
const nx = StyleSheet.create({
  root: { flex: 1, backgroundColor: NexusColors.bgPrimary },

  // Hero / avatar
  heroSection: {
    alignItems: 'center',
    paddingTop: NexusSpacing['3xl'],
    paddingBottom: NexusSpacing['2xl'],
    paddingHorizontal: NexusSpacing.xl,
  },
  avatarOuterRing: {
    width: 108,
    height: 108,
    borderRadius: NexusRadius.full,
    borderWidth: 3,
    borderColor: NexusColors.borderGlass,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: NexusSpacing.md,
  },
  avatarInner: {
    width: 90,
    height: 90,
    borderRadius: NexusRadius.full,
    backgroundColor: NexusColors.bgCardSolid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: NexusFonts.sizes['3xl'],
    fontWeight: NexusFonts.weights.black,
    color: NexusColors.accentCyan,
  },
  heroName: {
    fontSize: NexusFonts.sizes.xl,
    fontWeight: NexusFonts.weights.extrabold,
    color: NexusColors.textPrimary,
    marginBottom: NexusSpacing.xs,
  },
  heroEmail: {
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.textSecondary,
    marginBottom: NexusSpacing.sm,
  },
  rolePill: {
    backgroundColor: NexusColors.bgCardSolid,
    borderRadius: NexusRadius.full,
    paddingHorizontal: NexusSpacing.lg,
    paddingVertical: NexusSpacing.xs,
    borderWidth: 1,
    borderColor: NexusColors.borderGlass,
    marginBottom: NexusSpacing.xs,
  },
  rolePillText: {
    fontSize: NexusFonts.sizes.sm,
    fontWeight: NexusFonts.weights.semibold,
    color: NexusColors.textPrimary,
  },
  studentId: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
    marginBottom: NexusSpacing.xs,
  },
  bioBadge: {
    marginTop: NexusSpacing.xs,
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderRadius: NexusRadius.full,
    paddingHorizontal: NexusSpacing.md,
    paddingVertical: NexusSpacing.xs,
    borderWidth: 1,
    borderColor: NexusColors.accentEmerald,
  },
  bioBadgeText: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.semibold,
    color: NexusColors.accentEmerald,
    letterSpacing: NexusFonts.letterSpacing.wide,
  },

  body: { paddingHorizontal: NexusSpacing.xl },

  sectionLabel: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textSecondary,
    letterSpacing: NexusFonts.letterSpacing.widest,
    marginBottom: NexusSpacing.sm,
    marginTop: NexusSpacing.lg,
  },

  // Security grid (2×2)
  securityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 0,
    overflow: 'hidden',
  },
  securityItem: {
    width: '50%',
    alignItems: 'center',
    paddingVertical: NexusSpacing.lg,
    paddingHorizontal: NexusSpacing.md,
    gap: NexusSpacing.xs,
  },
  securityItemBorderRight: {
    borderRightWidth: 1,
    borderRightColor: NexusColors.borderGlass,
  },
  securityItemBorderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: NexusColors.borderGlass,
  },
  securityIcon: { fontSize: 22 },
  securityLabel: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
    textAlign: 'center',
  },
  securityStatus: { fontSize: NexusFonts.sizes.lg },

  // Timeline
  timelineCard: { padding: NexusSpacing.lg },
  emptyText: {
    color: NexusColors.textSecondary,
    fontSize: NexusFonts.sizes.sm,
    textAlign: 'center',
    paddingVertical: NexusSpacing.lg,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: NexusSpacing.md,
    gap: NexusSpacing.md,
  },
  timelineBorder: {
    borderBottomWidth: 1,
    borderBottomColor: NexusColors.borderGlass,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: NexusRadius.full,
  },
  timelineContent: { flex: 1 },
  timelineClass: {
    fontSize: NexusFonts.sizes.sm,
    fontWeight: NexusFonts.weights.semibold,
    color: NexusColors.textPrimary,
  },
  timelineTime: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
    marginTop: 2,
  },
  timelineVerified: { fontSize: NexusFonts.sizes.base },

  // Settings
  settingsCard: { paddingHorizontal: NexusSpacing.lg },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: NexusSpacing.lg,
    gap: NexusSpacing.md,
  },
  settingsBorder: {
    borderBottomWidth: 1,
    borderBottomColor: NexusColors.borderGlass,
  },
  settingsIconWrap: {
    width: 36,
    height: 36,
    borderRadius: NexusRadius.md,
    backgroundColor: NexusColors.bgCardSolid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: { fontSize: 18 },
  settingsLabel: {
    flex: 1,
    fontSize: NexusFonts.sizes.base,
    fontWeight: NexusFonts.weights.medium,
    color: NexusColors.textPrimary,
  },
  settingsChevron: { fontSize: 20, color: NexusColors.textSecondary },

  // Sign out
  signOutBtn: {
    marginTop: NexusSpacing.lg,
    borderWidth: 1.5,
    borderColor: NexusColors.accentRose,
    borderRadius: NexusRadius.lg,
    paddingVertical: NexusSpacing.lg,
    alignItems: 'center',
    backgroundColor: 'rgba(244,63,94,0.08)',
  },
  signOutText: {
    color: NexusColors.accentRose,
    fontSize: NexusFonts.sizes.base,
    fontWeight: NexusFonts.weights.bold,
  },

  // Edit modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: NexusColors.bgCardSolid,
    borderTopLeftRadius: NexusRadius['2xl'],
    borderTopRightRadius: NexusRadius['2xl'],
    padding: NexusSpacing['2xl'],
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: NexusColors.borderGlass,
  },
  modalTitle: {
    fontSize: NexusFonts.sizes.xl,
    fontWeight: NexusFonts.weights.extrabold,
    color: NexusColors.textPrimary,
    marginBottom: NexusSpacing.xl,
  },
  modalLabel: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.semibold,
    color: NexusColors.textSecondary,
    marginBottom: NexusSpacing.sm,
    letterSpacing: NexusFonts.letterSpacing.wide,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: NexusColors.borderGlass,
    borderRadius: NexusRadius.md,
    paddingHorizontal: NexusSpacing.lg,
    paddingVertical: NexusSpacing.md,
    fontSize: NexusFonts.sizes.base,
    color: NexusColors.textPrimary,
    backgroundColor: NexusColors.bgPrimary,
    marginBottom: NexusSpacing.lg,
  },
  modalActions: { flexDirection: 'row', gap: NexusSpacing.md, marginTop: NexusSpacing.sm },
  modalCancel: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: NexusColors.borderGlass,
    borderRadius: NexusRadius.md,
    paddingVertical: NexusSpacing.lg,
    alignItems: 'center',
  },
  modalCancelText: {
    color: NexusColors.textSecondary,
    fontWeight: NexusFonts.weights.bold,
    fontSize: NexusFonts.sizes.base,
  },
  modalSave: {
    flex: 1,
    backgroundColor: NexusColors.accentCyan,
    borderRadius: NexusRadius.md,
    paddingVertical: NexusSpacing.lg,
    alignItems: 'center',
  },
  modalSaveText: {
    color: NexusColors.bgPrimary,
    fontWeight: NexusFonts.weights.extrabold,
    fontSize: NexusFonts.sizes.base,
  },
});

// ─── Instructor Nexus styles ──────────────────────────────────────────────────
const ins = StyleSheet.create({
  root: { flex: 1, backgroundColor: NexusColors.bgPrimary },

  // Hero / avatar
  heroSection: {
    alignItems: 'center',
    paddingTop: NexusSpacing['3xl'],
    paddingBottom: NexusSpacing['2xl'],
    paddingHorizontal: NexusSpacing.xl,
  },
  avatarOuterRing: {
    width: 108,
    height: 108,
    borderRadius: NexusRadius.full,
    borderWidth: 3,
    borderColor: NexusColors.accentIndigo,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: NexusSpacing.md,
  },
  avatarInner: {
    width: 90,
    height: 90,
    borderRadius: NexusRadius.full,
    backgroundColor: NexusColors.bgCardSolid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: NexusFonts.sizes['3xl'],
    fontWeight: NexusFonts.weights.black,
    color: NexusColors.accentIndigo,
  },
  heroName: {
    fontSize: NexusFonts.sizes.xl,
    fontWeight: NexusFonts.weights.extrabold,
    color: NexusColors.textPrimary,
    marginBottom: NexusSpacing.xs,
  },
  heroEmail: {
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.textSecondary,
    marginBottom: NexusSpacing.sm,
  },
  rolePill: {
    backgroundColor: 'rgba(99,102,241,0.15)',
    borderRadius: NexusRadius.full,
    paddingHorizontal: NexusSpacing.lg,
    paddingVertical: NexusSpacing.xs,
    borderWidth: 1,
    borderColor: NexusColors.accentIndigo,
  },
  rolePillText: {
    fontSize: NexusFonts.sizes.sm,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.accentIndigo,
    letterSpacing: NexusFonts.letterSpacing.wider,
  },

  body: { paddingHorizontal: NexusSpacing.xl },

  sectionLabel: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textSecondary,
    letterSpacing: NexusFonts.letterSpacing.widest,
    marginBottom: NexusSpacing.sm,
    marginTop: NexusSpacing.lg,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: NexusSpacing.xl,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: NexusSpacing.xs,
  },
  statValue: {
    fontSize: NexusFonts.sizes['3xl'],
    fontWeight: NexusFonts.weights.black,
    color: NexusColors.accentIndigo,
  },
  statLabel: {
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.textSecondary,
    fontWeight: NexusFonts.weights.medium,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: NexusColors.borderGlass,
  },

  // Classes list
  classesCard: { paddingHorizontal: NexusSpacing.lg },
  classRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: NexusSpacing.lg,
    gap: NexusSpacing.md,
  },
  classBorder: {
    borderBottomWidth: 1,
    borderBottomColor: NexusColors.borderGlass,
  },
  classIconWrap: {
    width: 36,
    height: 36,
    borderRadius: NexusRadius.md,
    backgroundColor: NexusColors.bgCardSolid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  classIcon: { fontSize: 18 },
  classInfo: { flex: 1 },
  className: {
    fontSize: NexusFonts.sizes.base,
    fontWeight: NexusFonts.weights.semibold,
    color: NexusColors.textPrimary,
  },
  classMeta: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
    marginTop: 2,
  },
  enrollBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(99,102,241,0.12)',
    borderRadius: NexusRadius.md,
    paddingHorizontal: NexusSpacing.md,
    paddingVertical: NexusSpacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.25)',
  },
  enrollCount: {
    fontSize: NexusFonts.sizes.lg,
    fontWeight: NexusFonts.weights.extrabold,
    color: NexusColors.accentIndigo,
  },
  enrollLabel: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
  },

  // Settings
  settingsCard: { paddingHorizontal: NexusSpacing.lg },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: NexusSpacing.lg,
    gap: NexusSpacing.md,
  },
  settingsBorder: {
    borderBottomWidth: 1,
    borderBottomColor: NexusColors.borderGlass,
  },
  settingsIconWrap: {
    width: 36,
    height: 36,
    borderRadius: NexusRadius.md,
    backgroundColor: NexusColors.bgCardSolid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: { fontSize: 18 },
  settingsLabel: {
    flex: 1,
    fontSize: NexusFonts.sizes.base,
    fontWeight: NexusFonts.weights.medium,
    color: NexusColors.textPrimary,
  },
  settingsChevron: { fontSize: 20, color: NexusColors.textSecondary },

  // Sign out
  signOutBtn: {
    marginTop: NexusSpacing.lg,
    borderWidth: 1.5,
    borderColor: NexusColors.accentRose,
    borderRadius: NexusRadius.lg,
    paddingVertical: NexusSpacing.lg,
    alignItems: 'center',
    backgroundColor: 'rgba(244,63,94,0.08)',
  },
  signOutText: {
    color: NexusColors.accentRose,
    fontSize: NexusFonts.sizes.base,
    fontWeight: NexusFonts.weights.bold,
  },

  // Edit modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: NexusColors.bgCardSolid,
    borderTopLeftRadius: NexusRadius['2xl'],
    borderTopRightRadius: NexusRadius['2xl'],
    padding: NexusSpacing['2xl'],
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: NexusColors.borderGlass,
  },
  modalTitle: {
    fontSize: NexusFonts.sizes.xl,
    fontWeight: NexusFonts.weights.extrabold,
    color: NexusColors.textPrimary,
    marginBottom: NexusSpacing.xl,
  },
  modalLabel: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.semibold,
    color: NexusColors.textSecondary,
    marginBottom: NexusSpacing.sm,
    letterSpacing: NexusFonts.letterSpacing.wide,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: NexusColors.borderGlass,
    borderRadius: NexusRadius.md,
    paddingHorizontal: NexusSpacing.lg,
    paddingVertical: NexusSpacing.md,
    fontSize: NexusFonts.sizes.base,
    color: NexusColors.textPrimary,
    backgroundColor: NexusColors.bgPrimary,
    marginBottom: NexusSpacing.lg,
  },
  modalActions: { flexDirection: 'row', gap: NexusSpacing.md, marginTop: NexusSpacing.sm },
  modalCancel: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: NexusColors.borderGlass,
    borderRadius: NexusRadius.md,
    paddingVertical: NexusSpacing.lg,
    alignItems: 'center',
  },
  modalCancelText: {
    color: NexusColors.textSecondary,
    fontWeight: NexusFonts.weights.bold,
    fontSize: NexusFonts.sizes.base,
  },
  modalSave: {
    flex: 1,
    backgroundColor: NexusColors.accentIndigo,
    borderRadius: NexusRadius.md,
    paddingVertical: NexusSpacing.lg,
    alignItems: 'center',
  },
  modalSaveText: {
    color: NexusColors.textPrimary,
    fontWeight: NexusFonts.weights.extrabold,
    fontSize: NexusFonts.sizes.base,
  },
});
