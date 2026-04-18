import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, Animated, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { GlassmorphicCard, NexusStatusBar } from '@/components/nexus';
import { NexusColors, NexusFonts, NexusSpacing, NexusRadius } from '@/constants/theme';

// ─── Toggle component ─────────────────────────────────────────────────────────
function ToggleRow({
  icon, title, desc, value, onToggle, activeColor,
}: {
  icon: string; title: string; desc: string;
  value: boolean; onToggle: (v: boolean) => void; activeColor: string;
}) {
  const trackAnim = useRef(new Animated.Value(value ? 1 : 0)).current;
  const thumbX    = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(trackAnim, { toValue: value ? 1 : 0, duration: 250, useNativeDriver: false }),
      Animated.spring(thumbX,    { toValue: value ? 1 : 0, friction: 6, tension: 80, useNativeDriver: false }),
    ]).start();
  }, [value]);

  const trackBg  = trackAnim.interpolate({ inputRange: [0, 1], outputRange: [NexusColors.bgCardSolid, activeColor + '66'] });
  const thumbLeft = thumbX.interpolate({ inputRange: [0, 1], outputRange: [3, 23] });

  return (
    <View style={s.toggleRow}>
      <Text style={s.toggleIcon}>{icon}</Text>
      <View style={s.toggleText}>
        <Text style={s.toggleTitle}>{title}</Text>
        <Text style={s.toggleDesc}>{desc}</Text>
      </View>
      <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); onToggle(!value); }} activeOpacity={0.9}>
        <Animated.View style={[s.track, { backgroundColor: trackBg, borderColor: value ? activeColor : NexusColors.borderGlass }]}>
          <Animated.View style={[s.thumb, { left: thumbLeft }]} />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

// ─── Security Score Ring ──────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringColor = score > 80 ? NexusColors.accentEmerald : score > 50 ? NexusColors.accentAmber : NexusColors.accentRose;

  useEffect(() => {
    if (score < 60) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    }
  }, [score]);

  const circumference = 2 * Math.PI * 44;
  const strokeDash = (score / 100) * circumference;

  return (
    <Animated.View style={[s.ringWrap, { transform: [{ scale: pulseAnim }] }]}>
      <View style={[s.ringOuter, { borderColor: ringColor + '33' }]}>
        <View style={[s.ringInner, { borderColor: ringColor }]}>
          <Text style={[s.ringScore, { color: ringColor }]}>{score}%</Text>
          <Text style={s.ringLabel}>Score</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const ACTIVITY = [
  { event: 'Login', time: '2 min ago', device: 'iPhone 15', verified: true },
  { event: 'Attendance marked', time: '1 hr ago', device: 'iPhone 15', verified: true },
  { event: 'Data export', time: 'Yesterday', device: 'MacBook', verified: true },
  { event: 'Password changed', time: '3 days ago', device: 'iPhone 15', verified: true },
];

export default function StudentPrivacyScreen() {
  const [ghost, setGhost]     = useState(false);
  const [biometric, setBio]   = useState(true);
  const [precise, setPrecise] = useState(true);
  const [autoDelete, setAuto] = useState(false);

  const safeStates = [ghost, biometric, precise, !autoDelete];
  const enabledCount = [ghost, biometric, precise, autoDelete].filter(Boolean).length;
  const score = Math.round((enabledCount / 4) * 100);
  const allSafe = ghost && biometric && precise && !autoDelete;

  return (
    <View style={s.root}>
      <NexusStatusBar gpsState="active" ntpSynced />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={22} color={NexusColors.accentCyan} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>PRIVACY & SECURITY</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Security Score Hero */}
        <GlassmorphicCard glowColor={NexusColors.accentCyan} style={s.card}>
          <ScoreRing score={score} />
          <Text style={s.scoreText}>Your Security Score: {score}%</Text>
          <Text style={s.scoreSubtext}>Last checked: Just now</Text>
          {allSafe && (
            <View style={s.championBadge}>
              <Text style={s.championText}>🏆 Privacy Champion</Text>
            </View>
          )}
        </GlassmorphicCard>

        {/* Privacy Controls */}
        <Text style={s.sectionLabel}>PRIVACY CONTROLS</Text>
        <GlassmorphicCard style={s.card}>
          <ToggleRow icon="👻" title="Ghost Mode" desc="Hide my location from classmates on Campus Pulse"
            value={ghost} onToggle={setGhost} activeColor={NexusColors.accentCyan} />
          <View style={s.divider} />
          <ToggleRow icon="🛡️" title="Biometric Lock" desc="Require fingerprint/face for every attendance check"
            value={biometric} onToggle={setBio} activeColor={NexusColors.accentEmerald} />
          <View style={s.divider} />
          <ToggleRow icon="📍" title="Precise Location" desc="Use exact GPS (off = approximate for privacy)"
            value={precise} onToggle={setPrecise} activeColor={NexusColors.accentCyan} />
          <View style={s.divider} />
          <ToggleRow icon="🗑️" title="Auto-Delete Selfies" desc="Remove verification photos immediately after check"
            value={autoDelete} onToggle={setAuto} activeColor={NexusColors.accentAmber} />
        </GlassmorphicCard>

        {/* Your Data */}
        <Text style={s.sectionLabel}>YOUR DATA</Text>
        <GlassmorphicCard style={s.card}>
          <Text style={s.dataTitle}>127 attendance records stored · 7 years retention</Text>
          <View style={s.progressRow}>
            {[
              { label: 'GPS', pct: 30, color: NexusColors.accentCyan },
              { label: 'Biometric', pct: 0, color: NexusColors.accentEmerald },
              { label: 'Photos', pct: 15, color: NexusColors.accentAmber },
            ].map(seg => (
              <View key={seg.label} style={s.progressSeg}>
                <Text style={s.progressLabel}>{seg.label}</Text>
                <View style={s.progressTrack}>
                  <View style={[s.progressFill, { width: `${seg.pct}%` as any, backgroundColor: seg.color }]} />
                </View>
                <Text style={[s.progressPct, { color: seg.color }]}>{seg.pct}%</Text>
              </View>
            ))}
          </View>
          <View style={s.dataActions}>
            <TouchableOpacity style={s.ghostBtn} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})}>
              <Text style={s.ghostBtnText}>Export My Data</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.dangerBtn} onPress={() => Alert.alert('Delete Account', 'This will permanently delete all your data. This action cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive' }])}>
              <Text style={s.dangerBtnText}>Delete Account</Text>
            </TouchableOpacity>
          </View>
        </GlassmorphicCard>

        {/* Recent Activity */}
        <Text style={s.sectionLabel}>RECENT ACTIVITY</Text>
        <GlassmorphicCard style={s.card}>
          {ACTIVITY.map((a, i) => (
            <View key={i} style={[s.activityRow, i < ACTIVITY.length - 1 && s.divider]}>
              <View style={s.activityDot} />
              <View style={s.activityInfo}>
                <Text style={s.activityEvent}>{a.event}</Text>
                <Text style={s.activityMeta}>{a.time} · {a.device}</Text>
              </View>
              {a.verified && <Ionicons name="checkmark-circle" size={18} color={NexusColors.accentEmerald} />}
            </View>
          ))}
        </GlassmorphicCard>

        {/* Info footer */}
        <GlassmorphicCard style={[s.card, s.infoCard]}>
          <Ionicons name="shield-checkmark" size={20} color={NexusColors.accentEmerald} />
          <Text style={s.infoText}>Your biometric data never leaves this device. Zero-knowledge architecture.</Text>
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

  // Ring
  ringWrap: { alignItems: 'center', marginBottom: NexusSpacing.md },
  ringOuter: { width: 100, height: 100, borderRadius: 50, borderWidth: 8, alignItems: 'center', justifyContent: 'center' },
  ringInner: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  ringScore: { fontSize: NexusFonts.sizes.xl, fontWeight: NexusFonts.weights.black },
  ringLabel: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textSecondary },
  scoreText: { fontSize: NexusFonts.sizes.base, fontWeight: NexusFonts.weights.semibold, color: NexusColors.textPrimary, textAlign: 'center' },
  scoreSubtext: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textSecondary, textAlign: 'center', marginTop: 2 },
  championBadge: { marginTop: NexusSpacing.sm, alignSelf: 'center', backgroundColor: 'rgba(16,185,129,0.15)', borderRadius: NexusRadius.full, paddingHorizontal: NexusSpacing.lg, paddingVertical: NexusSpacing.xs, borderWidth: 1, borderColor: NexusColors.accentEmerald },
  championText: { fontSize: NexusFonts.sizes.xs, fontWeight: NexusFonts.weights.bold, color: NexusColors.accentEmerald },

  // Toggle
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: NexusSpacing.md, paddingVertical: NexusSpacing.xs },
  toggleIcon: { fontSize: 22, width: 28 },
  toggleText: { flex: 1 },
  toggleTitle: { fontSize: NexusFonts.sizes.base, fontWeight: NexusFonts.weights.semibold, color: NexusColors.textPrimary },
  toggleDesc: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textSecondary, marginTop: 2 },
  track: { width: 48, height: 28, borderRadius: NexusRadius.full, borderWidth: 1, justifyContent: 'center' },
  thumb: { position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: NexusColors.textPrimary, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },

  // Data
  dataTitle: { fontSize: NexusFonts.sizes.sm, color: NexusColors.textSecondary, marginBottom: NexusSpacing.md },
  progressRow: { gap: NexusSpacing.sm, marginBottom: NexusSpacing.md },
  progressSeg: { flexDirection: 'row', alignItems: 'center', gap: NexusSpacing.sm },
  progressLabel: { width: 64, fontSize: NexusFonts.sizes.xs, color: NexusColors.textSecondary },
  progressTrack: { flex: 1, height: 6, backgroundColor: NexusColors.bgCardSolid, borderRadius: NexusRadius.full, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: NexusRadius.full },
  progressPct: { width: 32, fontSize: NexusFonts.sizes.xs, fontWeight: NexusFonts.weights.bold, textAlign: 'right' },
  dataActions: { flexDirection: 'row', gap: NexusSpacing.md },
  ghostBtn: { flex: 1, borderWidth: 1, borderColor: NexusColors.accentCyan, borderRadius: NexusRadius.md, paddingVertical: NexusSpacing.md, alignItems: 'center' },
  ghostBtnText: { color: NexusColors.accentCyan, fontSize: NexusFonts.sizes.sm, fontWeight: NexusFonts.weights.bold },
  dangerBtn: { flex: 1, borderWidth: 1, borderColor: NexusColors.accentRose, borderRadius: NexusRadius.md, paddingVertical: NexusSpacing.md, alignItems: 'center', backgroundColor: 'rgba(244,63,94,0.08)' },
  dangerBtnText: { color: NexusColors.accentRose, fontSize: NexusFonts.sizes.sm, fontWeight: NexusFonts.weights.bold },

  // Activity
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: NexusSpacing.md, paddingVertical: NexusSpacing.sm },
  activityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: NexusColors.accentCyan },
  activityInfo: { flex: 1 },
  activityEvent: { fontSize: NexusFonts.sizes.sm, fontWeight: NexusFonts.weights.semibold, color: NexusColors.textPrimary },
  activityMeta: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textSecondary, marginTop: 2 },

  // Info
  infoCard: { flexDirection: 'row', alignItems: 'center', gap: NexusSpacing.md, backgroundColor: 'rgba(16,185,129,0.08)', borderColor: NexusColors.accentEmerald },
  infoText: { flex: 1, fontSize: NexusFonts.sizes.sm, color: NexusColors.textSecondary },
});
