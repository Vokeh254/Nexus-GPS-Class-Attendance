import React, { useRef, useState } from 'react';
import {
  Alert, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { GlassmorphicCard, NexusStatusBar } from '@/components/nexus';
import { NexusColors, NexusFonts, NexusSpacing, NexusRadius } from '@/constants/theme';

const QUICK_FIXES = [
  { icon: '📡', title: "Can't mark attendance", steps: 3, time: '2 min', urgent: false, successRate: null },
  { icon: '🔐', title: 'Biometric not working', steps: 4, time: '3 min', urgent: false, successRate: 94 },
  { icon: '📍', title: 'Missed but was there', steps: 5, time: '5 min', urgent: true, successRate: null },
];

const CHANNELS = [
  { icon: '💬', label: 'In-App Chat', eta: '< 2 min', status: 'ONLINE', statusColor: NexusColors.accentEmerald, extra: null },
  { icon: '✉️', label: 'Email', eta: '< 4 hours', status: 'ONLINE', statusColor: NexusColors.accentEmerald, extra: null },
  { icon: '👥', label: 'Community', eta: 'Peer-powered', status: 'HOT', statusColor: NexusColors.accentRose, extra: '1,247 active' },
  { icon: '📹', label: 'Video Call', eta: 'Schedule', status: 'LIMITED', statusColor: NexusColors.accentAmber, extra: null },
];

const LEARNING = [
  { title: 'Getting Started', progress: 75, badge: null },
  { title: 'Mastering Privacy', progress: 0, badge: null },
  { title: 'Nexus Coins & Rewards', progress: 30, badge: 'NEW' },
];

const TRENDING = ['Biometric failed', 'Wrong location', 'Missed attendance'];

export default function StudentHelpScreen() {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  const toggleAccordion = (i: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setExpanded(expanded === i ? null : i);
  };

  return (
    <View style={s.root}>
      <NexusStatusBar gpsState="active" ntpSynced />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={22} color={NexusColors.accentAmber} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>HELP & SUPPORT</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Search */}
        <GlassmorphicCard style={s.card}>
          <View style={s.searchRow}>
            <Ionicons name="search" size={18} color={NexusColors.textSecondary} />
            <TextInput
              style={s.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="What's wrong? e.g. 'GPS not working'"
              placeholderTextColor={NexusColors.textDisabled}
            />
          </View>
          <View style={s.chipRow}>
            {TRENDING.map(chip => (
              <TouchableOpacity key={chip} style={s.chip} onPress={() => setSearch(chip)}>
                <Text style={s.chipText}>{chip}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </GlassmorphicCard>

        {/* Quick Fix cards */}
        <Text style={s.sectionLabel}>QUICK FIXES</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.hScroll}>
          {QUICK_FIXES.map((fix, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                Alert.alert(fix.title, `${fix.steps} steps · ${fix.time}${fix.successRate ? ` · ${fix.successRate}% success rate` : ''}`);
              }}
            >
              <GlassmorphicCard style={[s.fixCard, fix.urgent && { borderColor: NexusColors.accentRose }]}>
                <Text style={s.fixIcon}>{fix.icon}</Text>
                <Text style={s.fixTitle}>{fix.title}</Text>
                <Text style={s.fixMeta}>{fix.steps} steps · {fix.time}</Text>
                {fix.successRate && <Text style={[s.fixRate, { color: NexusColors.accentEmerald }]}>{fix.successRate}% success</Text>}
                {fix.urgent && <Text style={[s.fixRate, { color: NexusColors.accentRose }]}>⚠️ Urgent</Text>}
              </GlassmorphicCard>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Support Channels */}
        <Text style={s.sectionLabel}>SUPPORT CHANNELS</Text>
        <GlassmorphicCard style={s.card}>
          <View style={s.channelGrid}>
            {CHANNELS.map((ch, i) => (
              <TouchableOpacity key={i} style={s.channelCell} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})}>
                <Text style={s.channelIcon}>{ch.icon}</Text>
                <Text style={s.channelLabel}>{ch.label}</Text>
                <Text style={s.channelEta}>{ch.eta}</Text>
                <View style={s.channelStatusRow}>
                  <View style={[s.statusDot, { backgroundColor: ch.statusColor }]} />
                  <Text style={[s.channelStatus, { color: ch.statusColor }]}>{ch.status}</Text>
                </View>
                {ch.extra && <Text style={s.channelExtra}>{ch.extra}</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </GlassmorphicCard>

        {/* Smart Troubleshooter */}
        <Text style={s.sectionLabel}>SMART TROUBLESHOOTER</Text>
        <GlassmorphicCard glowColor={NexusColors.accentAmber} style={s.card}>
          <Text style={s.troubleTitle}>🔍 Instant Diagnosis</Text>
          <Text style={s.troubleDesc}>Answer 3 questions, get instant diagnosis</Text>
          <TouchableOpacity style={s.amberBtn} onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            Alert.alert('Step 1 of 3', 'Is your GPS enabled?', [
              { text: 'No', onPress: () => Alert.alert('Step 2 of 3', 'Is your internet connected?', [{ text: 'No', onPress: () => Alert.alert('Diagnosis', 'Enable GPS and internet, then retry.') }, { text: 'Yes', onPress: () => Alert.alert('Diagnosis', 'GPS signal is weak. Move to an open area.') }]) },
              { text: 'Yes', onPress: () => Alert.alert('Step 2 of 3', 'Are you within 100m of the classroom?', [{ text: 'No', onPress: () => Alert.alert('Diagnosis', 'Move closer to the classroom and retry.') }, { text: 'Yes', onPress: () => Alert.alert('Diagnosis', 'Contact your instructor to manually mark attendance.') }]) },
            ]);
          }}>
            <Text style={s.amberBtnText}>Start Diagnosis</Text>
          </TouchableOpacity>
        </GlassmorphicCard>

        {/* Learning Center */}
        <Text style={s.sectionLabel}>LEARNING CENTER</Text>
        <GlassmorphicCard style={s.card}>
          {LEARNING.map((item, i) => (
            <View key={i}>
              <TouchableOpacity style={s.accordionRow} onPress={() => toggleAccordion(i)}>
                <View style={s.accordionLeft}>
                  <Text style={s.accordionTitle}>{item.title}</Text>
                  {item.badge && <View style={s.newBadge}><Text style={s.newBadgeText}>{item.badge}</Text></View>}
                </View>
                <View style={s.accordionRight}>
                  <Text style={s.accordionPct}>{item.progress}%</Text>
                  <Ionicons name={expanded === i ? 'chevron-up' : 'chevron-down'} size={16} color={NexusColors.textSecondary} />
                </View>
              </TouchableOpacity>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${item.progress}%` as any }]} />
              </View>
              {expanded === i && (
                <View style={s.accordionBody}>
                  <Text style={s.accordionBodyText}>Section 1 · Section 2 · Section 3</Text>
                </View>
              )}
              {i < LEARNING.length - 1 && <View style={s.divider} />}
            </View>
          ))}
        </GlassmorphicCard>

        {/* Emergency bar */}
        <View style={s.emergencyBar}>
          <Text style={s.emergencyText}>🚨 Security incident? Report immediately</Text>
          <TouchableOpacity style={s.emergencyBtn} onPress={() => Alert.alert('Emergency Line', 'Connecting to security team...')}>
            <Text style={s.emergencyBtnText}>Emergency Line</Text>
          </TouchableOpacity>
        </View>

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

  // Search
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: NexusSpacing.sm, borderWidth: 1, borderColor: NexusColors.borderGlass, borderRadius: NexusRadius.md, paddingHorizontal: NexusSpacing.md, paddingVertical: NexusSpacing.sm, marginBottom: NexusSpacing.md },
  searchInput: { flex: 1, fontSize: NexusFonts.sizes.base, color: NexusColors.textPrimary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: NexusSpacing.sm },
  chip: { backgroundColor: NexusColors.bgCardSolid, borderRadius: NexusRadius.full, paddingHorizontal: NexusSpacing.md, paddingVertical: NexusSpacing.xs, borderWidth: 1, borderColor: NexusColors.borderGlass },
  chipText: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textSecondary },

  // Quick Fix
  hScroll: { marginBottom: NexusSpacing.md },
  fixCard: { width: 160, padding: NexusSpacing.lg, marginRight: NexusSpacing.md },
  fixIcon: { fontSize: 28, marginBottom: NexusSpacing.sm },
  fixTitle: { fontSize: NexusFonts.sizes.sm, fontWeight: NexusFonts.weights.bold, color: NexusColors.textPrimary, marginBottom: NexusSpacing.xs },
  fixMeta: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textSecondary },
  fixRate: { fontSize: NexusFonts.sizes.xs, fontWeight: NexusFonts.weights.semibold, marginTop: NexusSpacing.xs },

  // Channels
  channelGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  channelCell: { width: '50%', padding: NexusSpacing.md, alignItems: 'center', gap: 4 },
  channelIcon: { fontSize: 24 },
  channelLabel: { fontSize: NexusFonts.sizes.sm, fontWeight: NexusFonts.weights.semibold, color: NexusColors.textPrimary },
  channelEta: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textSecondary },
  channelStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  channelStatus: { fontSize: NexusFonts.sizes.xs, fontWeight: NexusFonts.weights.bold },
  channelExtra: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textSecondary },

  // Troubleshooter
  troubleTitle: { fontSize: NexusFonts.sizes.lg, fontWeight: NexusFonts.weights.bold, color: NexusColors.textPrimary, marginBottom: NexusSpacing.xs },
  troubleDesc: { fontSize: NexusFonts.sizes.sm, color: NexusColors.textSecondary, marginBottom: NexusSpacing.md },
  amberBtn: { backgroundColor: NexusColors.accentAmber, borderRadius: NexusRadius.md, paddingVertical: NexusSpacing.md, alignItems: 'center' },
  amberBtnText: { color: NexusColors.bgPrimary, fontSize: NexusFonts.sizes.base, fontWeight: NexusFonts.weights.extrabold },

  // Accordion
  accordionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: NexusSpacing.sm },
  accordionLeft: { flexDirection: 'row', alignItems: 'center', gap: NexusSpacing.sm, flex: 1 },
  accordionTitle: { fontSize: NexusFonts.sizes.base, fontWeight: NexusFonts.weights.semibold, color: NexusColors.textPrimary },
  accordionRight: { flexDirection: 'row', alignItems: 'center', gap: NexusSpacing.sm },
  accordionPct: { fontSize: NexusFonts.sizes.xs, color: NexusColors.accentAmber, fontWeight: NexusFonts.weights.bold },
  accordionBody: { paddingVertical: NexusSpacing.sm },
  accordionBodyText: { fontSize: NexusFonts.sizes.sm, color: NexusColors.textSecondary },
  newBadge: { backgroundColor: NexusColors.accentAmber, borderRadius: NexusRadius.full, paddingHorizontal: NexusSpacing.sm, paddingVertical: 2 },
  newBadgeText: { fontSize: NexusFonts.sizes.xs, fontWeight: NexusFonts.weights.bold, color: NexusColors.bgPrimary },
  progressTrack: { height: 4, backgroundColor: NexusColors.bgCardSolid, borderRadius: NexusRadius.full, overflow: 'hidden', marginBottom: NexusSpacing.xs },
  progressFill: { height: '100%', backgroundColor: NexusColors.accentAmber, borderRadius: NexusRadius.full },

  // Emergency
  emergencyBar: { backgroundColor: 'rgba(244,63,94,0.15)', borderRadius: NexusRadius.lg, borderWidth: 1, borderColor: NexusColors.accentRose, padding: NexusSpacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: NexusSpacing.md, marginTop: NexusSpacing.sm },
  emergencyText: { flex: 1, fontSize: NexusFonts.sizes.sm, fontWeight: NexusFonts.weights.semibold, color: NexusColors.accentRose },
  emergencyBtn: { backgroundColor: NexusColors.accentRose, borderRadius: NexusRadius.md, paddingHorizontal: NexusSpacing.md, paddingVertical: NexusSpacing.sm },
  emergencyBtnText: { fontSize: NexusFonts.sizes.xs, fontWeight: NexusFonts.weights.extrabold, color: NexusColors.textPrimary },
});
