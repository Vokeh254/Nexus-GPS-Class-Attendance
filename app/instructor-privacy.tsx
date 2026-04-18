import React, { useRef, useState } from 'react';
import {
  Alert, Animated, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { GlassmorphicCard, NexusStatusBar } from '@/components/nexus';
import { NexusColors, NexusFonts, NexusSpacing, NexusRadius } from '@/constants/theme';

function ToggleRow({ icon, title, desc, value, onToggle }: {
  icon: string; title: string; desc: string; value: boolean; onToggle: (v: boolean) => void;
}) {
  const trackAnim = useRef(new Animated.Value(value ? 1 : 0)).current;
  const thumbX    = useRef(new Animated.Value(value ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(trackAnim, { toValue: value ? 1 : 0, duration: 250, useNativeDriver: false }),
      Animated.spring(thumbX,    { toValue: value ? 1 : 0, friction: 6, tension: 80, useNativeDriver: false }),
    ]).start();
  }, [value]);

  const trackBg  = trackAnim.interpolate({ inputRange: [0, 1], outputRange: [NexusColors.bgCardSolid, NexusColors.accentIndigo + '66'] });
  const thumbLeft = thumbX.interpolate({ inputRange: [0, 1], outputRange: [3, 23] });

  return (
    <View style={s.toggleRow}>
      <Text style={s.toggleIcon}>{icon}</Text>
      <View style={s.toggleText}>
        <Text style={s.toggleTitle}>{title}</Text>
        <Text style={s.toggleDesc}>{desc}</Text>
      </View>
      <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); onToggle(!value); }} activeOpacity={0.9}>
        <Animated.View style={[s.track, { backgroundColor: trackBg, borderColor: value ? NexusColors.accentIndigo : NexusColors.borderGlass }]}>
          <Animated.View style={[s.thumb, { left: thumbLeft }]} />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const AUDIT = [
  { action: 'View attendance', student: 'Alex Chen', time: '2 min ago', reason: 'Grade review' },
  { action: 'Export report', student: 'All students', time: '1 hr ago', reason: 'Semester report' },
  { action: 'View profile', student: 'Jordan Smith', time: '3 hr ago', reason: 'Dispute review' },
  { action: 'Mark present', student: 'Sam Lee', time: 'Yesterday', reason: 'Manual correction' },
];

const RETENTION = [
  { stage: 'Active Semester', status: 'LIVE', color: NexusColors.accentEmerald },
  { stage: '1 Year Post', status: 'ARCHIVED', color: NexusColors.accentAmber },
  { stage: '7 Years', status: 'COMPLIANCE', color: NexusColors.accentIndigo },
  { stage: 'Destruction', status: 'SCHEDULED', color: NexusColors.accentRose },
];

export default function InstructorPrivacyScreen() {
  const [geofence, setGeofence] = useState(true);
  const [proxy, setProxy]       = useState(true);
  const [selfie, setSelfie]     = useState(false);

  return (
    <View style={s.root}>
      <NexusStatusBar gpsState="active" ntpSynced />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={22} color={NexusColors.accentIndigo} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>DATA STEWARDSHIP</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Institutional Dashboard */}
        <GlassmorphicCard glowColor={NexusColors.accentIndigo} style={s.card}>
          <View style={s.enterpriseBadge}>
            <Text style={s.enterpriseBadgeText}>🏢 Enterprise Account</Text>
          </View>
          <Text style={s.dashTitle}>Data Stewardship Dashboard</Text>
          <Text style={s.dashSubtitle}>Managing 142 student records · 3 active courses</Text>
          <View style={s.complianceRow}>
            {['FERPA ✓', 'GDPR ✓', 'SOC 2 ✓'].map(badge => (
              <View key={badge} style={s.complianceBadge}>
                <Text style={s.complianceBadgeText}>{badge}</Text>
              </View>
            ))}
          </View>
          <View style={s.alertBanner}>
            <Ionicons name="checkmark-circle" size={16} color={NexusColors.accentEmerald} />
            <Text style={s.alertBannerText}>All systems compliant. Last audit: 2 hours ago</Text>
          </View>
        </GlassmorphicCard>

        {/* Access Scope */}
        <Text style={s.sectionLabel}>ACCESS SCOPE</Text>
        <GlassmorphicCard style={s.card}>
          {[
            { label: 'Your Students', count: '142', detail: 'attendance + analytics', color: NexusColors.accentIndigo, disabled: false },
            { label: 'Department Aggregate', count: '1,247', detail: 'anonymized trends only', color: NexusColors.textSecondary, disabled: false },
            { label: 'Individual Location', count: '0', detail: 'disabled by policy', color: NexusColors.textDisabled, disabled: true },
          ].map((scope, i) => (
            <View key={i} style={[s.scopeRow, i < 2 && s.divider]}>
              <View style={[s.scopeCircle, { borderColor: scope.color, opacity: scope.disabled ? 0.4 : 1 }]}>
                <Text style={[s.scopeCount, { color: scope.color }]}>{scope.count}</Text>
              </View>
              <View style={s.scopeInfo}>
                <Text style={[s.scopeLabel, scope.disabled && s.strikethrough]}>{scope.label}</Text>
                <Text style={s.scopeDetail}>{scope.detail}</Text>
              </View>
            </View>
          ))}
          <Text style={s.scopeNote}>You cannot see precise student locations, only classroom presence</Text>
        </GlassmorphicCard>

        {/* Audit Trail */}
        <Text style={s.sectionLabel}>AUDIT TRAIL</Text>
        <GlassmorphicCard style={s.card}>
          <View style={s.tableHeader}>
            {['Action', 'Student', 'Time', 'Reason'].map(h => (
              <Text key={h} style={s.tableHeaderText}>{h}</Text>
            ))}
          </View>
          {AUDIT.map((row, i) => (
            <View key={i} style={[s.tableRow, i < AUDIT.length - 1 && s.divider]}>
              <Text style={s.tableCell}>{row.action}</Text>
              <Text style={s.tableCell}>{row.student}</Text>
              <Text style={s.tableCell}>{row.time}</Text>
              <Text style={s.tableCell}>{row.reason}</Text>
            </View>
          ))}
          <View style={s.auditActions}>
            <TouchableOpacity style={s.ghostBtn} onPress={() => Alert.alert('Export', 'Exporting audit log...')}>
              <Text style={s.ghostBtnText}>Export Log</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.ghostBtn} onPress={() => Alert.alert('Full Audit', 'Requesting full audit report...')}>
              <Text style={s.ghostBtnText}>Full Audit</Text>
            </TouchableOpacity>
          </View>
        </GlassmorphicCard>

        {/* Pending Privacy Actions */}
        <Text style={s.sectionLabel}>PENDING ACTIONS</Text>
        <GlassmorphicCard style={[s.card, s.requestCard]}>
          <Text style={s.requestName}>Alex Chen</Text>
          <Text style={s.requestType}>Data Export Request</Text>
          <Text style={s.requestMeta}>2 days ago · 5 days remaining · Medium urgency</Text>
          <TouchableOpacity style={s.processBtn} onPress={() => Alert.alert('Process', 'Processing data export request...')}>
            <Text style={s.processBtnText}>Process</Text>
          </TouchableOpacity>
        </GlassmorphicCard>
        <GlassmorphicCard style={[s.card, s.requestCard, { borderColor: NexusColors.accentRose }]}>
          <Text style={s.requestName}>Jordan Smith</Text>
          <Text style={s.requestType}>Attendance Dispute</Text>
          <Text style={s.requestMeta}>6 hours ago · Evidence attached · High urgency</Text>
          <TouchableOpacity style={[s.processBtn, { backgroundColor: NexusColors.accentRose }]} onPress={() => Alert.alert('Review', 'Opening dispute review...')}>
            <Text style={[s.processBtnText, { color: NexusColors.textPrimary }]}>Review</Text>
          </TouchableOpacity>
        </GlassmorphicCard>

        {/* Classroom Security Settings */}
        <Text style={s.sectionLabel}>CLASSROOM SECURITY</Text>
        <GlassmorphicCard style={s.card}>
          <ToggleRow icon="📍" title="Geofence Strictness" desc="Strict radius enforcement for attendance" value={geofence} onToggle={setGeofence} />
          <View style={s.divider} />
          <ToggleRow icon="👥" title="Proxy Detection" desc="AI-powered proxy attendance detection" value={proxy} onToggle={setProxy} />
          <View style={s.divider} />
          <ToggleRow icon="📸" title="Random Selfie Verification" desc="Periodic photo verification during class" value={selfie} onToggle={setSelfie} />
        </GlassmorphicCard>

        {/* Data Retention Timeline */}
        <Text style={s.sectionLabel}>DATA RETENTION</Text>
        <GlassmorphicCard style={s.card}>
          {RETENTION.map((stage, i) => (
            <View key={i} style={[s.retentionRow, i < RETENTION.length - 1 && s.divider]}>
              <View style={[s.retentionDot, { backgroundColor: stage.color }]} />
              <Text style={s.retentionStage}>{stage.stage}</Text>
              <View style={[s.retentionBadge, { backgroundColor: stage.color + '22', borderColor: stage.color }]}>
                <Text style={[s.retentionBadgeText, { color: stage.color }]}>{stage.status}</Text>
              </View>
            </View>
          ))}
        </GlassmorphicCard>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: NexusColors.bgPrimary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: NexusSpacing.lg, paddingVertical: NexusSpacing.md, borderBottomWidth: 1, borderBottomColor: NexusColors.borderGlass },
  backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: NexusFonts.sizes.sm, fontWeight: NexusFonts.weights.bold, color: NexusColors.textPrimary, letterSpacing: NexusFonts.letterSpacing.widest },
  scroll: { padding: NexusSpacing.lg },
  card: { padding: NexusSpacing.lg, marginBottom: NexusSpacing.md },
  sectionLabel: { fontSize: NexusFonts.sizes.xs, fontWeight: NexusFonts.weights.bold, color: NexusColors.textSecondary, letterSpacing: NexusFonts.letterSpacing.widest, marginBottom: NexusSpacing.sm, marginTop: NexusSpacing.sm },
  divider: { height: 1, backgroundColor: NexusColors.borderGlass, marginVertical: NexusSpacing.sm },

  // Dashboard
  enterpriseBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(99,102,241,0.15)', borderRadius: NexusRadius.full, paddingHorizontal: NexusSpacing.md, paddingVertical: NexusSpacing.xs, borderWidth: 1, borderColor: NexusColors.accentIndigo, marginBottom: NexusSpacing.sm },
  enterpriseBadgeText: { fontSize: NexusFonts.sizes.xs, fontWeight: NexusFonts.weights.bold, color: NexusColors.accentIndigo },
  dashTitle: { fontSize: NexusFonts.sizes.lg, fontWeight: NexusFonts.weights.extrabold, color: NexusColors.textPrimary, marginBottom: NexusSpacing.xs },
  dashSubtitle: { fontSize: NexusFonts.sizes.sm, color: NexusColors.textSecondary, marginBottom: NexusSpacing.md },
  complianceRow: { flexDirection: 'row', gap: NexusSpacing.sm, marginBottom: NexusSpacing.md },
  complianceBadge: { backgroundColor: 'rgba(16,185,129,0.15)', borderRadius: NexusRadius.full, paddingHorizontal: NexusSpacing.md, paddingVertical: NexusSpacing.xs, borderWidth: 1, borderColor: NexusColors.accentEmerald },
  complianceBadgeText: { fontSize: NexusFonts.sizes.xs, fontWeight: NexusFonts.weights.bold, color: NexusColors.accentEmerald },
  alertBanner: { flexDirection: 'row', alignItems: 'center', gap: NexusSpacing.sm, backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: NexusRadius.md, padding: NexusSpacing.md },
  alertBannerText: { fontSize: NexusFonts.sizes.sm, color: NexusColors.accentEmerald },

  // Scope
  scopeRow: { flexDirection: 'row', alignItems: 'center', gap: NexusSpacing.md, paddingVertical: NexusSpacing.sm },
  scopeCircle: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  scopeCount: { fontSize: NexusFonts.sizes.sm, fontWeight: NexusFonts.weights.extrabold },
  scopeInfo: { flex: 1 },
  scopeLabel: { fontSize: NexusFonts.sizes.base, fontWeight: NexusFonts.weights.semibold, color: NexusColors.textPrimary },
  scopeDetail: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textSecondary, marginTop: 2 },
  strikethrough: { textDecorationLine: 'line-through', color: NexusColors.textDisabled },
  scopeNote: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textSecondary, marginTop: NexusSpacing.sm, fontStyle: 'italic' },

  // Table
  tableHeader: { flexDirection: 'row', marginBottom: NexusSpacing.sm },
  tableHeaderText: { flex: 1, fontSize: NexusFonts.sizes.xs, fontWeight: NexusFonts.weights.bold, color: NexusColors.textSecondary, letterSpacing: NexusFonts.letterSpacing.wide },
  tableRow: { flexDirection: 'row', paddingVertical: NexusSpacing.xs },
  tableCell: { flex: 1, fontSize: NexusFonts.sizes.xs, color: NexusColors.textPrimary },
  auditActions: { flexDirection: 'row', gap: NexusSpacing.md, marginTop: NexusSpacing.md },
  ghostBtn: { flex: 1, borderWidth: 1, borderColor: NexusColors.accentIndigo, borderRadius: NexusRadius.md, paddingVertical: NexusSpacing.sm, alignItems: 'center' },
  ghostBtnText: { color: NexusColors.accentIndigo, fontSize: NexusFonts.sizes.sm, fontWeight: NexusFonts.weights.bold },

  // Requests
  requestCard: { borderWidth: 1, borderColor: NexusColors.borderGlass },
  requestName: { fontSize: NexusFonts.sizes.base, fontWeight: NexusFonts.weights.extrabold, color: NexusColors.textPrimary },
  requestType: { fontSize: NexusFonts.sizes.sm, fontWeight: NexusFonts.weights.semibold, color: NexusColors.accentIndigo, marginTop: 2 },
  requestMeta: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textSecondary, marginTop: 4, marginBottom: NexusSpacing.md },
  processBtn: { backgroundColor: NexusColors.accentIndigo, borderRadius: NexusRadius.md, paddingVertical: NexusSpacing.sm, alignItems: 'center' },
  processBtnText: { fontSize: NexusFonts.sizes.sm, fontWeight: NexusFonts.weights.bold, color: NexusColors.textPrimary },

  // Toggle
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: NexusSpacing.md, paddingVertical: NexusSpacing.xs },
  toggleIcon: { fontSize: 22, width: 28 },
  toggleText: { flex: 1 },
  toggleTitle: { fontSize: NexusFonts.sizes.base, fontWeight: NexusFonts.weights.semibold, color: NexusColors.textPrimary },
  toggleDesc: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textSecondary, marginTop: 2 },
  track: { width: 48, height: 28, borderRadius: NexusRadius.full, borderWidth: 1, justifyContent: 'center' },
  thumb: { position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: NexusColors.textPrimary, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },

  // Retention
  retentionRow: { flexDirection: 'row', alignItems: 'center', gap: NexusSpacing.md, paddingVertical: NexusSpacing.sm },
  retentionDot: { width: 10, height: 10, borderRadius: 5 },
  retentionStage: { flex: 1, fontSize: NexusFonts.sizes.sm, fontWeight: NexusFonts.weights.semibold, color: NexusColors.textPrimary },
  retentionBadge: { borderRadius: NexusRadius.full, paddingHorizontal: NexusSpacing.md, paddingVertical: 2, borderWidth: 1 },
  retentionBadgeText: { fontSize: NexusFonts.sizes.xs, fontWeight: NexusFonts.weights.bold },
});
