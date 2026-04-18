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

const TLDR = [
  'We only track location to verify class attendance',
  'Your face/fingerprint stays on your phone only',
  "We don't sell data to anyone, ever",
  'You can delete everything except grade records',
  'Your school can see attendance, not your location history',
];

const POLICIES = [
  { icon: '📍', label: 'Location Data', detail: 'We collect GPS coordinates only during attendance check-in. Location data is never stored beyond the verification window.' },
  { icon: '🛡️', label: 'Biometric Security', detail: 'Biometric templates are processed on-device using the secure enclave. We never receive or store your biometric data.' },
  { icon: '📊', label: 'Academic Records', detail: 'Attendance records are shared with your institution as required by enrollment agreements. You can request a full export at any time.' },
  { icon: '🗑️', label: 'Your Rights', detail: 'You have the right to access, correct, and delete your personal data. Submit requests through the app or email privacy@nexus.app.' },
];

const JOURNEY = [
  { icon: '📱', label: 'Collected', time: 'Check-in', location: 'Your device' },
  { icon: '🔐', label: 'Encrypted', time: 'Instant', location: 'On-device' },
  { icon: '☁️', label: 'Verified', time: '< 1 sec', location: 'Nexus servers' },
  { icon: '🎓', label: 'Stored', time: 'Permanent', location: 'University DB' },
  { icon: '🗑️', label: 'Deleted', time: '7 years', location: 'Scheduled' },
];

const DOCS = [
  { title: 'Terms of Service', version: 'v3.0', readTime: '12 min read', badges: [] },
  { title: 'Privacy Policy', version: 'v2.1', readTime: '8 min read', badges: ['GDPR', 'CCPA', 'FERPA'] },
  { title: 'Cookie Policy', version: 'v1.0', readTime: '2 min read', badges: [], note: "We don't use tracking cookies" },
];

export default function StudentTermsScreen() {
  const [eli10, setEli10] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const trackAnim = useRef(new Animated.Value(0)).current;
  const thumbX    = useRef(new Animated.Value(0)).current;

  const toggleEli10 = () => {
    const next = !eli10;
    setEli10(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Animated.parallel([
      Animated.timing(trackAnim, { toValue: next ? 1 : 0, duration: 250, useNativeDriver: false }),
      Animated.spring(thumbX,    { toValue: next ? 1 : 0, friction: 6, tension: 80, useNativeDriver: false }),
    ]).start();
  };

  const trackBg  = trackAnim.interpolate({ inputRange: [0, 1], outputRange: [NexusColors.bgCardSolid, NexusColors.accentCyan + '66'] });
  const thumbLeft = thumbX.interpolate({ inputRange: [0, 1], outputRange: [3, 23] });

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
          <Ionicons name="chevron-back" size={22} color={NexusColors.textSecondary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>TERMS & PRIVACY</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ELI10 Toggle */}
        <GlassmorphicCard style={s.card}>
          <View style={s.eli10Row}>
            <View style={s.eli10Text}>
              <Text style={s.eli10Title}>Explain Like I'm 10</Text>
              <Text style={s.eli10Desc}>{eli10 ? 'Simple mode ON — easy language' : 'Toggle for ultra-simple explanations'}</Text>
            </View>
            <TouchableOpacity onPress={toggleEli10} activeOpacity={0.9}>
              <Animated.View style={[s.track, { backgroundColor: trackBg, borderColor: eli10 ? NexusColors.accentCyan : NexusColors.borderGlass }]}>
                <Animated.View style={[s.thumb, { left: thumbLeft }]} />
              </Animated.View>
            </TouchableOpacity>
          </View>
        </GlassmorphicCard>

        {/* TL;DR */}
        <GlassmorphicCard style={[s.card, s.tldrCard]}>
          <Text style={s.tldrHeading}>📋 The Short Version</Text>
          {TLDR.map((point, i) => (
            <View key={i} style={s.tldrRow}>
              <Text style={s.tldrCheck}>✅</Text>
              <Text style={s.tldrText}>{eli10 ? point.replace('verify class attendance', 'check you went to class').replace('secure enclave', 'safe chip') : point}</Text>
            </View>
          ))}
          <Text style={s.tldrDate}>Last updated: April 15, 2026</Text>
        </GlassmorphicCard>

        {/* Policy Explorer */}
        <Text style={s.sectionLabel}>POLICY EXPLORER</Text>
        <GlassmorphicCard style={s.card}>
          <View style={s.policyGrid}>
            {POLICIES.map((p, i) => (
              <TouchableOpacity key={i} style={s.policyBtn} onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                Alert.alert(p.label, p.detail);
              }}>
                <Text style={s.policyIcon}>{p.icon}</Text>
                <Text style={s.policyLabel}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </GlassmorphicCard>

        {/* Data Journey */}
        <Text style={s.sectionLabel}>DATA JOURNEY</Text>
        <GlassmorphicCard style={s.card}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={s.journeyRow}>
              {JOURNEY.map((stage, i) => (
                <React.Fragment key={i}>
                  <TouchableOpacity style={s.journeyStage} onPress={() => Alert.alert(stage.label, `Time: ${stage.time}\nLocation: ${stage.location}`)}>
                    <Text style={s.journeyIcon}>{stage.icon}</Text>
                    <Text style={s.journeyLabel}>{stage.label}</Text>
                    <Text style={s.journeyTime}>{stage.time}</Text>
                    <Text style={s.journeyLoc}>{stage.location}</Text>
                  </TouchableOpacity>
                  {i < JOURNEY.length - 1 && <Text style={s.journeyArrow}>→</Text>}
                </React.Fragment>
              ))}
            </View>
          </ScrollView>
        </GlassmorphicCard>

        {/* Full Legal Documents */}
        <Text style={s.sectionLabel}>LEGAL DOCUMENTS</Text>
        <GlassmorphicCard style={s.card}>
          {DOCS.map((doc, i) => (
            <View key={i}>
              <TouchableOpacity style={s.accordionRow} onPress={() => toggleAccordion(i)}>
                <View style={s.accordionLeft}>
                  <Text style={s.accordionTitle}>{doc.title}</Text>
                  <Text style={s.accordionMeta}>{doc.version} · {doc.readTime}</Text>
                </View>
                <Ionicons name={expanded === i ? 'chevron-up' : 'chevron-down'} size={16} color={NexusColors.textSecondary} />
              </TouchableOpacity>
              {doc.badges.length > 0 && (
                <View style={s.badgeRow}>
                  {doc.badges.map(b => <View key={b} style={s.badge}><Text style={s.badgeText}>{b}</Text></View>)}
                </View>
              )}
              {doc.note && <Text style={s.docNote}>{doc.note}</Text>}
              {expanded === i && (
                <View style={s.docActions}>
                  <TouchableOpacity style={s.docBtn} onPress={() => Alert.alert('Full Document', `Opening ${doc.title}...`)}>
                    <Text style={s.docBtnText}>Read Full</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.docBtn} onPress={() => Alert.alert('Simplified', `Opening simplified ${doc.title}...`)}>
                    <Text style={s.docBtnText}>Read Simplified</Text>
                  </TouchableOpacity>
                </View>
              )}
              {i < DOCS.length - 1 && <View style={s.divider} />}
            </View>
          ))}
        </GlassmorphicCard>

        {/* Consent footer */}
        <GlassmorphicCard style={s.card}>
          <Text style={s.consentText}>Agreed to Terms on: Sep 1, 2024</Text>
          <TouchableOpacity style={s.downloadBtn} onPress={() => Alert.alert('Download', 'Preparing your data export...')}>
            <Ionicons name="download-outline" size={16} color={NexusColors.accentCyan} />
            <Text style={s.downloadBtnText}>Download My Data</Text>
          </TouchableOpacity>
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

  // ELI10
  eli10Row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: NexusSpacing.md },
  eli10Text: { flex: 1 },
  eli10Title: { fontSize: NexusFonts.sizes.base, fontWeight: NexusFonts.weights.semibold, color: NexusColors.textPrimary },
  eli10Desc: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textSecondary, marginTop: 2 },
  track: { width: 48, height: 28, borderRadius: NexusRadius.full, borderWidth: 1, justifyContent: 'center' },
  thumb: { position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: NexusColors.textPrimary, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },

  // TL;DR
  tldrCard: { borderColor: NexusColors.accentCyan, borderWidth: 1.5 },
  tldrHeading: { fontSize: NexusFonts.sizes.lg, fontWeight: NexusFonts.weights.bold, color: NexusColors.textPrimary, marginBottom: NexusSpacing.md },
  tldrRow: { flexDirection: 'row', gap: NexusSpacing.sm, marginBottom: NexusSpacing.sm },
  tldrCheck: { fontSize: 14 },
  tldrText: { flex: 1, fontSize: NexusFonts.sizes.sm, color: NexusColors.textSecondary, lineHeight: 20 },
  tldrDate: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textDisabled, marginTop: NexusSpacing.sm },

  // Policy
  policyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: NexusSpacing.sm },
  policyBtn: { width: '47%', backgroundColor: NexusColors.bgCardSolid, borderRadius: NexusRadius.md, padding: NexusSpacing.md, alignItems: 'center', gap: NexusSpacing.xs, borderWidth: 1, borderColor: NexusColors.borderGlass },
  policyIcon: { fontSize: 24 },
  policyLabel: { fontSize: NexusFonts.sizes.sm, fontWeight: NexusFonts.weights.semibold, color: NexusColors.textPrimary, textAlign: 'center' },

  // Journey
  journeyRow: { flexDirection: 'row', alignItems: 'center', gap: NexusSpacing.sm },
  journeyStage: { alignItems: 'center', width: 80 },
  journeyIcon: { fontSize: 24, marginBottom: 4 },
  journeyLabel: { fontSize: NexusFonts.sizes.xs, fontWeight: NexusFonts.weights.bold, color: NexusColors.textPrimary, textAlign: 'center' },
  journeyTime: { fontSize: NexusFonts.sizes.xs, color: NexusColors.accentCyan, textAlign: 'center' },
  journeyLoc: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textSecondary, textAlign: 'center' },
  journeyArrow: { fontSize: 18, color: NexusColors.textDisabled },

  // Accordion
  accordionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: NexusSpacing.sm },
  accordionLeft: { flex: 1 },
  accordionTitle: { fontSize: NexusFonts.sizes.base, fontWeight: NexusFonts.weights.semibold, color: NexusColors.textPrimary },
  accordionMeta: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textSecondary, marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: NexusSpacing.xs, marginBottom: NexusSpacing.xs },
  badge: { backgroundColor: 'rgba(6,182,212,0.15)', borderRadius: NexusRadius.full, paddingHorizontal: NexusSpacing.sm, paddingVertical: 2, borderWidth: 1, borderColor: NexusColors.accentCyan },
  badgeText: { fontSize: NexusFonts.sizes.xs, fontWeight: NexusFonts.weights.bold, color: NexusColors.accentCyan },
  docNote: { fontSize: NexusFonts.sizes.xs, color: NexusColors.accentEmerald, marginBottom: NexusSpacing.xs },
  docActions: { flexDirection: 'row', gap: NexusSpacing.md, paddingVertical: NexusSpacing.sm },
  docBtn: { flex: 1, borderWidth: 1, borderColor: NexusColors.borderGlass, borderRadius: NexusRadius.md, paddingVertical: NexusSpacing.sm, alignItems: 'center' },
  docBtnText: { fontSize: NexusFonts.sizes.xs, fontWeight: NexusFonts.weights.semibold, color: NexusColors.textSecondary },

  // Consent
  consentText: { fontSize: NexusFonts.sizes.sm, color: NexusColors.textSecondary, marginBottom: NexusSpacing.md },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', gap: NexusSpacing.sm, borderWidth: 1, borderColor: NexusColors.accentCyan, borderRadius: NexusRadius.md, paddingVertical: NexusSpacing.md, justifyContent: 'center' },
  downloadBtnText: { fontSize: NexusFonts.sizes.sm, fontWeight: NexusFonts.weights.bold, color: NexusColors.accentCyan },
});
