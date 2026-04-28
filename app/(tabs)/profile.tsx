import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Image, Modal, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';
import ThemeToggle from '@/components/ThemeToggle';
import NexusLoader from '@/components/NexusLoader';
import AuthService from '@/services/AuthService';
import { GlassmorphicCard, NexusStatusBar } from '@/components/nexus';
import { NexusColors, NexusFonts, NexusSpacing, NexusRadius } from '@/constants/theme';
import type { Profile, AttendanceLog, Class } from '@/types';

interface ClassSummary extends Class { enrollmentCount: number }

const SECURITY_ITEMS = [
  { icon: '🔐', label: 'Biometric Linked', value: true },
  { icon: '📱', label: 'Device Trusted',   value: true },
  { icon: '🔑', label: '2FA Enabled',      value: true },
  { icon: '💾', label: 'Backup Codes',     value: false },
] as const;

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ProfileScreen() {
  const { isDark } = useTheme();

  // ── Profile state ──────────────────────────────────────────────────────────
  const [profile, setProfile]   = useState<Profile | null>(null);
  const [email, setEmail]       = useState('');
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory]   = useState<AttendanceLog[]>([]);
  const [classSummaries, setClassSummaries] = useState<ClassSummary[]>([]);

  // ── Edit profile modal ─────────────────────────────────────────────────────
  const [editVisible, setEditVisible]       = useState(false);
  const [editName, setEditName]             = useState('');
  const [editStudentId, setEditStudentId]   = useState('');
  const [editCourse, setEditCourse]         = useState('');
  const [editYear, setEditYear]             = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editStaffNumber, setEditStaffNumber] = useState('');
  const [avatarUri, setAvatarUri]           = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving]                 = useState(false);

  // ── Change password modal ──────────────────────────────────────────────────
  const [pwdVisible, setPwdVisible]         = useState(false);
  const [currentPwd, setCurrentPwd]         = useState('');
  const [newPwd, setNewPwd]                 = useState('');
  const [confirmPwd, setConfirmPwd]         = useState('');
  const [changingPwd, setChangingPwd]       = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? '');

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single();
      if (prof) {
        setProfile(prof);
        setAvatarUri(prof.avatar_url ?? null);
      }

      if (prof?.role === 'instructor') {
        const { data: classes } = await supabase
          .from('classes').select('*').eq('instructor_id', user.id)
          .order('created_at', { ascending: false });
        if (classes?.length) {
          const summaries = await Promise.all(
            classes.map(async (cls: Class) => {
              const { count } = await supabase
                .from('enrollments').select('*', { count: 'exact', head: true })
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
          .from('attendance_logs').select('*').eq('student_id', user.id)
          .order('signed_at', { ascending: false }).limit(10);
        if (logs) setHistory(logs);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Pick & upload avatar ───────────────────────────────────────────────────

  async function pickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setUploadingAvatar(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const ext = asset.uri.split('.').pop() ?? 'jpg';
      const path = `avatars/${user.id}.${ext}`;

      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: `image/${ext}` });

      if (uploadError) { Alert.alert('Upload failed', uploadError.message); return; }

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);

      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      setAvatarUri(publicUrl);
      setProfile(p => p ? { ...p, avatar_url: publicUrl } : p);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not upload photo.');
    } finally {
      setUploadingAvatar(false);
    }
  }

  // ── Save profile ───────────────────────────────────────────────────────────

  async function saveProfile() {
    if (!profile) return;
    setSaving(true);
    const updates: Record<string, any> = { full_name: editName.trim() };
    if (profile.role === 'student') {
      updates.student_id  = editStudentId.trim() || null;
      updates.course      = editCourse.trim() || null;
      updates.year_of_study = editYear.trim() || null;
    } else {
      updates.department  = editDepartment.trim() || null;
      updates.staff_number = editStaffNumber.trim() || null;
    }
    const { error } = await supabase.from('profiles').update(updates).eq('id', profile.id);
    setSaving(false);
    if (!error) {
      setProfile(p => p ? { ...p, ...updates } : p);
      setEditVisible(false);
    } else {
      Alert.alert('Error', 'Could not save. Please try again.');
    }
  }

  // ── Change password ────────────────────────────────────────────────────────

  async function changePassword() {
    if (!newPwd.trim()) { Alert.alert('Required', 'Enter a new password.'); return; }
    if (newPwd.length < 8) { Alert.alert('Too short', 'Password must be at least 8 characters.'); return; }
    if (newPwd !== confirmPwd) { Alert.alert('Mismatch', 'Passwords do not match.'); return; }

    setChangingPwd(true);

    // Re-authenticate with current password first
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPwd,
    });

    if (signInError) {
      setChangingPwd(false);
      Alert.alert('Wrong Password', 'Current password is incorrect.');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setChangingPwd(false);

    if (error) {
      Alert.alert('Failed', error.message);
    } else {
      Alert.alert('Success', 'Password changed successfully.');
      setPwdVisible(false);
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    }
  }

  if (loading) return <NexusLoader />;

  const initials = profile?.full_name
    ?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) ?? '?';
  const isInstructor = profile?.role === 'instructor';

  // ── Shared avatar component ────────────────────────────────────────────────
  const AvatarHero = ({ accentColor }: { accentColor: string }) => (
    <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8} style={{ alignItems: 'center' }}>
      <View style={[sh.avatarRing, { borderColor: accentColor }]}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={sh.avatarImage} />
        ) : (
          <View style={sh.avatarInner}>
            <Text style={[sh.avatarInitials, { color: accentColor }]}>{initials}</Text>
          </View>
        )}
        <View style={[sh.cameraBtn, { backgroundColor: accentColor }]}>
          <Text style={sh.cameraBtnText}>{uploadingAvatar ? '…' : '📷'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  // ── Change Password Modal (shared) ─────────────────────────────────────────
  const PasswordModal = ({ accent }: { accent: string }) => (
    <Modal visible={pwdVisible} animationType="slide" transparent>
      <View style={sh.modalOverlay}>
        <View style={sh.modalCard}>
          <Text style={sh.modalTitle}>Change Password</Text>

          <Text style={sh.modalLabel}>Current Password</Text>
          <TextInput style={sh.modalInput} value={currentPwd} onChangeText={setCurrentPwd}
            placeholder="Enter current password" placeholderTextColor={NexusColors.textDisabled}
            secureTextEntry autoCapitalize="none" />

          <Text style={sh.modalLabel}>New Password</Text>
          <TextInput style={sh.modalInput} value={newPwd} onChangeText={setNewPwd}
            placeholder="Min. 8 characters" placeholderTextColor={NexusColors.textDisabled}
            secureTextEntry autoCapitalize="none" />

          <Text style={sh.modalLabel}>Confirm New Password</Text>
          <TextInput style={sh.modalInput} value={confirmPwd} onChangeText={setConfirmPwd}
            placeholder="Repeat new password" placeholderTextColor={NexusColors.textDisabled}
            secureTextEntry autoCapitalize="none" />

          <View style={sh.modalActions}>
            <TouchableOpacity style={sh.modalCancel}
              onPress={() => { setPwdVisible(false); setCurrentPwd(''); setNewPwd(''); setConfirmPwd(''); }}>
              <Text style={sh.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[sh.modalSave, { backgroundColor: accent }, changingPwd && { opacity: 0.6 }]}
              onPress={changePassword} disabled={changingPwd}>
              <Text style={sh.modalSaveText}>{changingPwd ? 'Changing…' : 'Change'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // ── INSTRUCTOR BRANCH ──────────────────────────────────────────────────────
  if (isInstructor) {
    const totalEnrolled = classSummaries.reduce((s, c) => s + c.enrollmentCount, 0);

    return (
      <View style={ins.root}>
        <NexusStatusBar gpsState="active" ntpSynced />

        <ScrollView showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(); }}
            tintColor={NexusColors.accentIndigo} />}>

          {/* Avatar */}
          <View style={ins.heroSection}>
            <AvatarHero accentColor={NexusColors.accentIndigo} />
            <Text style={ins.heroName}>{profile?.full_name ?? '—'}</Text>
            <Text style={ins.heroEmail}>{email}</Text>
            <View style={ins.rolePill}><Text style={ins.rolePillText}>🎓 INSTRUCTOR</Text></View>
          </View>

          <View style={ins.body}>
            {/* Stats */}
            <Text style={ins.sectionLabel}>ADMINISTRATION OVERVIEW</Text>
            <GlassmorphicCard style={ins.statsGrid} glowColor={NexusColors.accentIndigo}>
              <View style={ins.statItem}>
                <Text style={ins.statValue}>{classSummaries.length}</Text>
                <Text style={ins.statLabel}>Units Teaching</Text>
              </View>
              <View style={ins.statDivider} />
              <View style={ins.statItem}>
                <Text style={ins.statValue}>{totalEnrolled}</Text>
                <Text style={ins.statLabel}>Total Students</Text>
              </View>
            </GlassmorphicCard>

            {/* Staff details */}
            <Text style={ins.sectionLabel}>STAFF DETAILS</Text>
            <GlassmorphicCard style={ins.detailsCard} glowColor={NexusColors.accentIndigo}>
              {[
                { label: 'Department',    value: profile?.department },
                { label: 'Staff Number',  value: profile?.staff_number },
                { label: 'Units Teaching', value: String(classSummaries.length) },
              ].map((row, i, arr) => (
                <View key={row.label} style={[ins.detailRow, i < arr.length - 1 && ins.detailBorder]}>
                  <Text style={ins.detailLabel}>{row.label}</Text>
                  <Text style={ins.detailValue}>{row.value || '—'}</Text>
                </View>
              ))}
            </GlassmorphicCard>

            {/* Classes */}
            {classSummaries.length > 0 && (
              <>
                <Text style={ins.sectionLabel}>MY CLASSES</Text>
                <GlassmorphicCard style={ins.classesCard}>
                  {classSummaries.map((cls, i) => (
                    <View key={cls.id} style={[ins.classRow, i < classSummaries.length - 1 && ins.classBorder]}>
                      <View style={ins.classIconWrap}><Text style={ins.classIcon}>📚</Text></View>
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

            {/* Settings */}
            <Text style={ins.sectionLabel}>SETTINGS</Text>
            <GlassmorphicCard style={ins.settingsCard}>
              {[
                { icon: '✏️', label: 'Edit Profile', onPress: () => {
                    setEditName(profile?.full_name ?? '');
                    setEditDepartment(profile?.department ?? '');
                    setEditStaffNumber(profile?.staff_number ?? '');
                    setEditVisible(true);
                  }},
                { icon: '🔑', label: 'Change Password', onPress: () => setPwdVisible(true) },
                { icon: '🎨', label: 'Appearance', onPress: () => {}, hasToggle: true },
                { icon: '🔒', label: 'Privacy & Security', onPress: () => router.push('/instructor-privacy') },
                { icon: '❓', label: 'Help & Support', onPress: () => router.push('/instructor-help') },
                { icon: '📄', label: 'Terms & Privacy', onPress: () => router.push('/instructor-terms') },
              ].map((item, i, arr) => (
                <TouchableOpacity key={item.label}
                  style={[ins.settingsRow, i < arr.length - 1 && ins.settingsBorder]}
                  onPress={item.hasToggle ? undefined : item.onPress}
                  activeOpacity={item.hasToggle ? 1 : 0.7} disabled={item.hasToggle}>
                  <View style={ins.settingsIconWrap}><Text style={ins.settingsIcon}>{item.icon}</Text></View>
                  <Text style={ins.settingsLabel}>{item.label}</Text>
                  {item.hasToggle ? <ThemeToggle /> : <Text style={ins.settingsChevron}>›</Text>}
                </TouchableOpacity>
              ))}
            </GlassmorphicCard>

            <TouchableOpacity style={ins.signOutBtn}
              onPress={async () => { await AuthService.signOut(); router.replace('/login'); }}
              activeOpacity={0.8}>
              <Text style={ins.signOutText}>🚪 Sign Out</Text>
            </TouchableOpacity>
            <View style={{ height: 32 }} />
          </View>
        </ScrollView>

        {/* Edit Profile Modal */}
        <Modal visible={editVisible} animationType="slide" transparent>
          <View style={sh.modalOverlay}>
            <View style={sh.modalCard}>
              <Text style={sh.modalTitle}>Edit Profile</Text>
              {[
                { label: 'Full Name', value: editName, setter: setEditName, placeholder: 'Your full name' },
                { label: 'Department', value: editDepartment, setter: setEditDepartment, placeholder: 'e.g. Computer Science' },
                { label: 'Staff Number', value: editStaffNumber, setter: setEditStaffNumber, placeholder: 'e.g. STF-00123' },
              ].map(f => (
                <View key={f.label}>
                  <Text style={sh.modalLabel}>{f.label}</Text>
                  <TextInput style={sh.modalInput} value={f.value} onChangeText={f.setter}
                    placeholder={f.placeholder} placeholderTextColor={NexusColors.textDisabled} />
                </View>
              ))}
              <View style={sh.modalActions}>
                <TouchableOpacity style={sh.modalCancel} onPress={() => setEditVisible(false)}>
                  <Text style={sh.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[sh.modalSave, { backgroundColor: NexusColors.accentIndigo }, saving && { opacity: 0.6 }]}
                  onPress={saveProfile} disabled={saving}>
                  <Text style={sh.modalSaveText}>{saving ? 'Saving…' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <PasswordModal accent={NexusColors.accentIndigo} />
      </View>
    );
  }

  // ── STUDENT BRANCH ─────────────────────────────────────────────────────────
  return (
    <View style={nx.root}>
      <NexusStatusBar gpsState="active" ntpSynced />

      <ScrollView showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchData(); }}
          tintColor={NexusColors.accentCyan} />}>

        {/* Avatar */}
        <View style={nx.heroSection}>
          <AvatarHero accentColor={NexusColors.accentCyan} />
          <Text style={nx.heroName}>{profile?.full_name ?? '—'}</Text>
          <Text style={nx.heroEmail}>{email}</Text>
          <View style={nx.rolePill}><Text style={nx.rolePillText}>🎒 Student</Text></View>
          {profile?.student_id && <Text style={nx.studentId}>ID: {profile.student_id}</Text>}
          {profile?.course && <Text style={nx.studentId}>📚 {profile.course}</Text>}
          {(profile as any)?.year_of_study && (
            <Text style={nx.studentId}>📅 Year {(profile as any).year_of_study}</Text>
          )}
        </View>

        <View style={nx.body}>
          {/* Security grid */}
          <Text style={nx.sectionLabel}>SECURITY STATUS</Text>
          <GlassmorphicCard style={nx.securityGrid} glowColor={NexusColors.accentCyan}>
            {SECURITY_ITEMS.map((item, i) => (
              <View key={item.label} style={[
                nx.securityItem,
                i % 2 === 0 && i < SECURITY_ITEMS.length - 1 && nx.securityItemBorderRight,
                i < 2 && nx.securityItemBorderBottom,
              ]}>
                <Text style={nx.securityIcon}>{item.icon}</Text>
                <Text style={nx.securityLabel}>{item.label}</Text>
                <Text style={[nx.securityStatus, { color: item.value ? NexusColors.accentEmerald : NexusColors.accentAmber }]}>
                  {item.value ? '✅' : '⚠️'}
                </Text>
              </View>
            ))}
          </GlassmorphicCard>

          {/* Geofence history */}
          <Text style={nx.sectionLabel}>GEOFENCE HISTORY</Text>
          <GlassmorphicCard style={nx.timelineCard}>
            {history.length === 0 ? (
              <Text style={nx.emptyText}>No check-in history yet.</Text>
            ) : (
              history.map((log, i) => (
                <View key={log.id} style={[nx.timelineItem, i < history.length - 1 && nx.timelineBorder]}>
                  <View style={[nx.timelineDot, { backgroundColor: log.verified ? NexusColors.accentEmerald : NexusColors.accentAmber }]} />
                  <View style={nx.timelineContent}>
                    <Text style={nx.timelineClass}>{log.class_id}</Text>
                    <Text style={nx.timelineTime}>{formatDate(log.signed_at)} · {formatTime(log.signed_at)}</Text>
                  </View>
                  <Text style={[nx.timelineVerified, { color: log.verified ? NexusColors.accentEmerald : NexusColors.accentAmber }]}>
                    {log.verified ? '✅' : '⏳'}
                  </Text>
                </View>
              ))
            )}
          </GlassmorphicCard>

          {/* Settings */}
          <Text style={nx.sectionLabel}>SETTINGS</Text>
          <GlassmorphicCard style={nx.settingsCard}>
            {[
              { icon: '✏️', label: 'Edit Profile', onPress: () => {
                  setEditName(profile?.full_name ?? '');
                  setEditStudentId(profile?.student_id ?? '');
                  setEditCourse(profile?.course ?? '');
                  setEditYear((profile as any)?.year_of_study ?? '');
                  setEditVisible(true);
                }},
              { icon: '🔑', label: 'Change Password', onPress: () => setPwdVisible(true) },
              { icon: '🏆', label: 'Achievement Gallery', onPress: () => router.push('/(tabs)/achievements') },
              { icon: '🎨', label: 'Appearance', onPress: () => {}, hasToggle: true },
              { icon: '🔒', label: 'Privacy & Security', onPress: () => router.push('/student-privacy') },
              { icon: '❓', label: 'Help & Support', onPress: () => router.push('/student-help') },
              { icon: '📄', label: 'Terms & Privacy', onPress: () => router.push('/student-terms') },
            ].map((item, i, arr) => (
              <TouchableOpacity key={item.label}
                style={[nx.settingsRow, i < arr.length - 1 && nx.settingsBorder]}
                onPress={item.hasToggle ? undefined : item.onPress}
                activeOpacity={item.hasToggle ? 1 : 0.7} disabled={item.hasToggle}>
                <View style={nx.settingsIconWrap}><Text style={nx.settingsIcon}>{item.icon}</Text></View>
                <Text style={nx.settingsLabel}>{item.label}</Text>
                {item.hasToggle ? <ThemeToggle /> : <Text style={nx.settingsChevron}>›</Text>}
              </TouchableOpacity>
            ))}
          </GlassmorphicCard>

          <TouchableOpacity style={nx.signOutBtn}
            onPress={async () => { await AuthService.signOut(); router.replace('/login'); }}
            activeOpacity={0.8}>
            <Text style={nx.signOutText}>🚪 Sign Out</Text>
          </TouchableOpacity>
          <View style={{ height: 32 }} />
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={editVisible} animationType="slide" transparent>
        <View style={sh.modalOverlay}>
          <View style={sh.modalCard}>
            <Text style={sh.modalTitle}>Edit Profile</Text>
            {[
              { label: 'Full Name', value: editName, setter: setEditName, placeholder: 'Your full name' },
              { label: 'Student ID', value: editStudentId, setter: setEditStudentId, placeholder: 'Institutional ID' },
              { label: 'Course', value: editCourse, setter: setEditCourse, placeholder: 'e.g. BSc Computer Science' },
              { label: 'Year of Study', value: editYear, setter: setEditYear, placeholder: 'e.g. 2', keyboard: 'number-pad' as const },
            ].map(f => (
              <View key={f.label}>
                <Text style={sh.modalLabel}>{f.label}</Text>
                <TextInput style={sh.modalInput} value={f.value} onChangeText={f.setter}
                  placeholder={f.placeholder} placeholderTextColor={NexusColors.textDisabled}
                  keyboardType={f.keyboard ?? 'default'} />
              </View>
            ))}
            <View style={sh.modalActions}>
              <TouchableOpacity style={sh.modalCancel} onPress={() => setEditVisible(false)}>
                <Text style={sh.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[sh.modalSave, { backgroundColor: NexusColors.accentCyan }, saving && { opacity: 0.6 }]}
                onPress={saveProfile} disabled={saving}>
                <Text style={sh.modalSaveText}>{saving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <PasswordModal accent={NexusColors.accentCyan} />
    </View>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const sh = StyleSheet.create({
  avatarRing: {
    width: 108, height: 108, borderRadius: 54,
    borderWidth: 3, alignItems: 'center', justifyContent: 'center',
    marginBottom: NexusSpacing.md, position: 'relative',
  },
  avatarImage: { width: 96, height: 96, borderRadius: 48 },
  avatarInner: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: NexusColors.bgCardSolid,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: NexusFonts.sizes['3xl'],
    fontWeight: NexusFonts.weights.black,
  },
  cameraBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: NexusColors.bgPrimary,
  },
  cameraBtnText: { fontSize: 14 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: NexusColors.bgCardSolid,
    borderTopLeftRadius: NexusRadius['2xl'], borderTopRightRadius: NexusRadius['2xl'],
    padding: NexusSpacing['2xl'], paddingBottom: 40,
    borderWidth: 1, borderColor: NexusColors.borderGlass,
  },
  modalTitle: {
    fontSize: NexusFonts.sizes.xl, fontWeight: NexusFonts.weights.extrabold,
    color: NexusColors.textPrimary, marginBottom: NexusSpacing.xl,
  },
  modalLabel: {
    fontSize: NexusFonts.sizes.xs, fontWeight: NexusFonts.weights.semibold,
    color: NexusColors.textSecondary, marginBottom: NexusSpacing.sm,
    letterSpacing: NexusFonts.letterSpacing.wide,
  },
  modalInput: {
    borderWidth: 1.5, borderColor: NexusColors.borderGlass,
    borderRadius: NexusRadius.md, paddingHorizontal: NexusSpacing.lg,
    paddingVertical: NexusSpacing.md, fontSize: NexusFonts.sizes.base,
    color: NexusColors.textPrimary, backgroundColor: NexusColors.bgPrimary,
    marginBottom: NexusSpacing.lg,
  },
  modalActions: { flexDirection: 'row', gap: NexusSpacing.md, marginTop: NexusSpacing.sm },
  modalCancel: {
    flex: 1, borderWidth: 1.5, borderColor: NexusColors.borderGlass,
    borderRadius: NexusRadius.md, paddingVertical: NexusSpacing.lg, alignItems: 'center',
  },
  modalCancelText: {
    color: NexusColors.textSecondary, fontWeight: NexusFonts.weights.bold,
    fontSize: NexusFonts.sizes.base,
  },
  modalSave: {
    flex: 1, borderRadius: NexusRadius.md,
    paddingVertical: NexusSpacing.lg, alignItems: 'center',
  },
  modalSaveText: {
    color: NexusColors.bgPrimary, fontWeight: NexusFonts.weights.extrabold,
    fontSize: NexusFonts.sizes.base,
  },
});

// ── Student styles ────────────────────────────────────────────────────────────
const nx = StyleSheet.create({
  root: { flex: 1, backgroundColor: NexusColors.bgPrimary },
  heroSection: {
    alignItems: 'center', paddingTop: NexusSpacing['3xl'],
    paddingBottom: NexusSpacing['2xl'], paddingHorizontal: NexusSpacing.xl,
  },
  heroName: {
    fontSize: NexusFonts.sizes.xl, fontWeight: NexusFonts.weights.extrabold,
    color: NexusColors.textPrimary, marginBottom: NexusSpacing.xs,
  },
  heroEmail: { fontSize: NexusFonts.sizes.sm, color: NexusColors.textSecondary, marginBottom: NexusSpacing.sm },
  rolePill: {
    backgroundColor: NexusColors.bgCardSolid, borderRadius: NexusRadius.full,
    paddingHorizontal: NexusSpacing.lg, paddingVertical: NexusSpacing.xs,
    borderWidth: 1, borderColor: NexusColors.borderGlass, marginBottom: NexusSpacing.xs,
  },
  rolePillText: { fontSize: NexusFonts.sizes.sm, fontWeight: NexusFonts.weights.semibold, color: NexusColors.textPrimary },
  studentId: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textSecondary, marginBottom: NexusSpacing.xs },
  body: { paddingHorizontal: NexusSpacing.xl },
  sectionLabel: {
    fontSize: NexusFonts.sizes.xs, fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textSecondary, letterSpacing: NexusFonts.letterSpacing.widest,
    marginBottom: NexusSpacing.sm, marginTop: NexusSpacing.lg,
  },
  securityGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 0, overflow: 'hidden' },
  securityItem: { width: '50%', alignItems: 'center', paddingVertical: NexusSpacing.lg, paddingHorizontal: NexusSpacing.md, gap: NexusSpacing.xs },
  securityItemBorderRight: { borderRightWidth: 1, borderRightColor: NexusColors.borderGlass },
  securityItemBorderBottom: { borderBottomWidth: 1, borderBottomColor: NexusColors.borderGlass },
  securityIcon: { fontSize: 22 },
  securityLabel: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textSecondary, textAlign: 'center' },
  securityStatus: { fontSize: NexusFonts.sizes.lg },
  timelineCard: { padding: NexusSpacing.lg },
  emptyText: { color: NexusColors.textSecondary, fontSize: NexusFonts.sizes.sm, textAlign: 'center', paddingVertical: NexusSpacing.lg },
  timelineItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: NexusSpacing.md, gap: NexusSpacing.md },
  timelineBorder: { borderBottomWidth: 1, borderBottomColor: NexusColors.borderGlass },
  timelineDot: { width: 10, height: 10, borderRadius: NexusRadius.full },
  timelineContent: { flex: 1 },
  timelineClass: { fontSize: NexusFonts.sizes.sm, fontWeight: NexusFonts.weights.semibold, color: NexusColors.textPrimary },
  timelineTime: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textSecondary, marginTop: 2 },
  timelineVerified: { fontSize: NexusFonts.sizes.base },
  settingsCard: { paddingHorizontal: NexusSpacing.lg },
  settingsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: NexusSpacing.lg, gap: NexusSpacing.md },
  settingsBorder: { borderBottomWidth: 1, borderBottomColor: NexusColors.borderGlass },
  settingsIconWrap: { width: 36, height: 36, borderRadius: NexusRadius.md, backgroundColor: NexusColors.bgCardSolid, alignItems: 'center', justifyContent: 'center' },
  settingsIcon: { fontSize: 18 },
  settingsLabel: { flex: 1, fontSize: NexusFonts.sizes.base, fontWeight: NexusFonts.weights.medium, color: NexusColors.textPrimary },
  settingsChevron: { fontSize: 20, color: NexusColors.textSecondary },
  signOutBtn: { marginTop: NexusSpacing.lg, borderWidth: 1.5, borderColor: NexusColors.accentRose, borderRadius: NexusRadius.lg, paddingVertical: NexusSpacing.lg, alignItems: 'center', backgroundColor: 'rgba(244,63,94,0.08)' },
  signOutText: { color: NexusColors.accentRose, fontSize: NexusFonts.sizes.base, fontWeight: NexusFonts.weights.bold },
});

// ── Instructor styles ─────────────────────────────────────────────────────────
const ins = StyleSheet.create({
  root: { flex: 1, backgroundColor: NexusColors.bgPrimary },
  heroSection: { alignItems: 'center', paddingTop: NexusSpacing['3xl'], paddingBottom: NexusSpacing['2xl'], paddingHorizontal: NexusSpacing.xl },
  heroName: { fontSize: NexusFonts.sizes.xl, fontWeight: NexusFonts.weights.extrabold, color: NexusColors.textPrimary, marginBottom: NexusSpacing.xs },
  heroEmail: { fontSize: NexusFonts.sizes.sm, color: NexusColors.textSecondary, marginBottom: NexusSpacing.sm },
  rolePill: { backgroundColor: 'rgba(99,102,241,0.15)', borderRadius: NexusRadius.full, paddingHorizontal: NexusSpacing.lg, paddingVertical: NexusSpacing.xs, borderWidth: 1, borderColor: NexusColors.accentIndigo },
  rolePillText: { fontSize: NexusFonts.sizes.sm, fontWeight: NexusFonts.weights.bold, color: NexusColors.accentIndigo, letterSpacing: NexusFonts.letterSpacing.wider },
  body: { paddingHorizontal: NexusSpacing.xl },
  sectionLabel: { fontSize: NexusFonts.sizes.xs, fontWeight: NexusFonts.weights.bold, color: NexusColors.textSecondary, letterSpacing: NexusFonts.letterSpacing.widest, marginBottom: NexusSpacing.sm, marginTop: NexusSpacing.lg },
  statsGrid: { flexDirection: 'row', alignItems: 'center', paddingVertical: NexusSpacing.xl },
  statItem: { flex: 1, alignItems: 'center', gap: NexusSpacing.xs },
  statValue: { fontSize: NexusFonts.sizes['3xl'], fontWeight: NexusFonts.weights.black, color: NexusColors.accentIndigo },
  statLabel: { fontSize: NexusFonts.sizes.sm, color: NexusColors.textSecondary, fontWeight: NexusFonts.weights.medium },
  statDivider: { width: 1, height: 40, backgroundColor: NexusColors.borderGlass },
  detailsCard: { paddingHorizontal: NexusSpacing.lg },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: NexusSpacing.md },
  detailBorder: { borderBottomWidth: 1, borderBottomColor: NexusColors.borderGlass },
  detailLabel: { fontSize: NexusFonts.sizes.sm, color: NexusColors.textSecondary },
  detailValue: { fontSize: NexusFonts.sizes.sm, fontWeight: NexusFonts.weights.semibold, color: NexusColors.textPrimary, maxWidth: '60%', textAlign: 'right' },
  classesCard: { paddingHorizontal: NexusSpacing.lg },
  classRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: NexusSpacing.lg, gap: NexusSpacing.md },
  classBorder: { borderBottomWidth: 1, borderBottomColor: NexusColors.borderGlass },
  classIconWrap: { width: 36, height: 36, borderRadius: NexusRadius.md, backgroundColor: NexusColors.bgCardSolid, alignItems: 'center', justifyContent: 'center' },
  classIcon: { fontSize: 18 },
  classInfo: { flex: 1 },
  className: { fontSize: NexusFonts.sizes.base, fontWeight: NexusFonts.weights.semibold, color: NexusColors.textPrimary },
  classMeta: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textSecondary, marginTop: 2 },
  enrollBadge: { alignItems: 'center' },
  enrollCount: { fontSize: NexusFonts.sizes.lg, fontWeight: NexusFonts.weights.black, color: NexusColors.accentIndigo },
  enrollLabel: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textSecondary },
  settingsCard: { paddingHorizontal: NexusSpacing.lg },
  settingsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: NexusSpacing.lg, gap: NexusSpacing.md },
  settingsBorder: { borderBottomWidth: 1, borderBottomColor: NexusColors.borderGlass },
  settingsIconWrap: { width: 36, height: 36, borderRadius: NexusRadius.md, backgroundColor: NexusColors.bgCardSolid, alignItems: 'center', justifyContent: 'center' },
  settingsIcon: { fontSize: 18 },
  settingsLabel: { flex: 1, fontSize: NexusFonts.sizes.base, fontWeight: NexusFonts.weights.medium, color: NexusColors.textPrimary },
  settingsChevron: { fontSize: 20, color: NexusColors.textSecondary },
  signOutBtn: { marginTop: NexusSpacing.lg, borderWidth: 1.5, borderColor: NexusColors.accentRose, borderRadius: NexusRadius.lg, paddingVertical: NexusSpacing.lg, alignItems: 'center', backgroundColor: 'rgba(244,63,94,0.08)' },
  signOutText: { color: NexusColors.accentRose, fontSize: NexusFonts.sizes.base, fontWeight: NexusFonts.weights.bold },
});
