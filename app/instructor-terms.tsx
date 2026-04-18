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

const OBLIGATIONS = {
  University: ['Maintain FERPA compliance', 'Provide accurate enrollment data', 'Notify students of data use'],
  Nexus: ['Encrypt all data in transit', 'Provide 99.9% uptime SLA', 'Delete data on contract end'],
  'You/Instructor': ['Use data only for attendance', 'Report security incidents', 'Complete annual training'],
};

const DOCS = [
  { title: 'Master Service Agreement', pages: 42, date: 'Aug 2025', clauses: 3, requiresSignature: false },
  { title: 'Data Processing Addendum', pages: 18, date: 'March 2026', clauses: 0, badges: ['GDPR', 'FERPA'], requiresSignature: false },
  { title: 'Instructor Terms of Use', pages: 12, date: 'April 2026', clauses: 0, requiresSignature: true },
  { title: 'Student Privacy Notice', pages: 4, date: 'April 2026', clauses: 0, syllabusTemplate: true, requiresSignature: false },
];

const AMENDMENTS = [
  { date: 'March 2026', summary: 'Added biometric data provisions', impact: 'No action required', approver: 'Legal Dept' },
  { date: 'Jan 2026', summary: 'Updated FERPA compliance clauses', impact: 'Review recommended', approver: 'Compliance' },
  { date: 'Oct 2025', summary: 'Extended data retention to 7 years', impact: 'Acknowledged', approver: 'University' },
  { date: 'Aug 2025', summary: 'Initial contract execution', impact: 'Signed', approver: 'Both parties' },
];

const LEGAL_CONTACTS = [
  { name: 'University Legal Counsel', contact: 'legal@university.edu', phone: 'x7777', hours: 'Mon-Fri 9-5' },
  { name: 'Nexus Legal', contact: 'legal@nexus.app', phone: '1-800-NEXUS', hours: '24/7 for urgent' },
];

export default function InstructorTermsScreen() {
  const [expanded, setExpanded] = useState<number | null>(0);
  const pendingActions = 2;

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
        <Text style={s.headerTitle}>LEGAL & COMPLIANCE</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Contract Summary Hero */}
        <GlassmorphicCard glowColor={NexusColors.accentAmber} style={s.card}>
          <View style={s.enterpriseBadge}>
            <Text style={s.enterpriseBadgeText}>📋 Enterprise Agreement</Text>
          </View>
          <Text style={s.contractTitle}>University-Nexus Contract</Text>
          <Text style={s.contractDates}>Effective: August 1, 2025 · Renewal: July 31, 2027</Text>

          {/* Health Score Ring */}
          <View style={s.scoreRow}>
            <View style={s.scoreRing}>
              <Text style={s.scoreNum}>94%</Text>
              <Text style={s.scoreLabel}>Health</Text>
            </View>
            <View style={s.obligationMatrix}>
              {Object.entries(OBLIGATIONS).map(([party, items]) => (
                <View key={party} style={s.obligationCol}>
                  <Text style={s.obligationParty}>{party}</Text>
                  {items.map((item, i) => <Text key={i} style={s.obligationItem}>• {item}</Text>)}
                  <View style={s.compliantBadge}>
                    <Text style={s.compliantText}>COMPLIANT</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </GlassmorphicCard>

        {/* Your Legal Position */}
        <Text style={s.sectionLabel}>YOUR LEGAL POSITION</Text>
        <GlassmorphicCard style={s.card}>
          <Text style={s.protectionTitle}>🛡️ Institutional Indemnification</Text>
          <Text style={s.protectionDesc}>Coverage up to $2M for good-faith use of the platform</Text>
          <Text style={s.protectionAmount}>$2,000,000</Text>
          <Text style={s.protectionExceptions}>Exceptions: Gross negligence, intentional misuse, unauthorized data sharing</Text>
        </GlassmorphicCard>
        <GlassmorphicCard style={s.card}>
          <Text style={s.protectionTitle}>⚖️ Nexus Liability Cap</Text>
          <Text style={s.protectionDesc}>Nexus liability limited to annual fees or $50,000, whichever is greater</Text>
          <Text style={s.protectionAmount}>$50,000</Text>
          <Text style={s.protectionExceptions}>Exceptions: Data breaches caused by Nexus negligence, GDPR violations</Text>
        </GlassmorphicCard>

        {/* Governing Documents */}
        <Text style={s.sectionLabel}>GOVERNING DOCUMENTS</Text>
        <GlassmorphicCard style={s.card}>
          {DOCS.map((doc, i) => (
            <View key={i}>
              <TouchableOpacity style={s.accordionRow} onPress={() => toggleAccordion(i)}>
                <View style={s.accordionLeft}>
                  <Text style={s.accordionTitle}>{doc.title}</Text>
                  <Text style={s.accordionMeta}>{doc.pages} pages · {doc.date}</Text>
                </View>
                <View style={s.accordionRight}>
                  {doc.requiresSignature && <View style={s.sigBadge}><Text style={s.sigBadgeText}>SIGN</Text></View>}
                  <Ionicons name={expanded === i ? 'chevron-up' : 'chevron-down'} size={16} color={NexusColors.textSecondary} />
                </View>
              </TouchableOpacity>
              {'badges' in doc && doc.badges && (
                <View style={s.badgeRow}>
                  {doc.badges.map((b: string) => <View key={b} style={s.badge}><Text style={s.badgeText}>{b}</Text></View>)}
                </View>
              )}
              {doc.syllabusTemplate && <Text style={s.syllabusNote}>📄 Syllabus template available</Text>}
              {expanded === i && (
                <View style={s.docActions}>
                  <TouchableOpacity style={s.docBtn} onPress={() => Alert.alert('View', `Opening ${doc.title}...`)}>
                    <Text style={s.docBtnText}>View Full</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.docBtn} onPress={() => Alert.alert('Download', `Downloading ${doc.title}...`)}>
                    <Text style={s.docBtnText}>Download</Text>
                  </TouchableOpacity>
                </View>
              )}
              {i < DOCS.length - 1 && <View style={s.divider} />}
            </View>
          ))}
        </GlassmorphicCard>

        {/* Policy Alignment Check */}
        <Text style={s.sectionLabel}>POLICY ALIGNMENT</Text>
        <GlassmorphicCard style={s.card}>
          <View style={[s.alignItem, { borderLeftColor: NexusColors.accentAmber }]}>
            <Ionicons name="warning" size={16} color={NexusColors.accentAmber} />
            <Text style={s.alignText}>University requires 48hr dispute resolution, Nexus allows 72hr. Consider amendment.</Text>
          </View>
          <View style={[s.alignItem, { borderLeftColor: NexusColors.accentEmerald, marginTop: NexusSpacing.md }]}>
            <Ionicons name="checkmark-circle" size={16} color={NexusColors.accentEmerald} />
            <Text style={s.alignText}>Nexus biometric retention matches university policy ✓</Text>
          </View>
        </GlassmorphicCard>

        {/* Amendment History */}
        <Text style={s.sectionLabel}>AMENDMENT HISTORY</Text>
        <GlassmorphicCard style={s.card}>
          {AMENDMENTS.map((a, i) => (
            <View key={i} style={[s.amendRow, i < AMENDMENTS.length - 1 && s.divider]}>
              <View style={s.amendDot} />
              <View style={s.amendInfo}>
                <Text style={s.amendDate}>{a.date}</Text>
                <Text style={s.amendSummary}>{a.summary}</Text>
                <Text style={s.amendMeta}>Impact: {a.impact} · Approver: {a.approver}</Text>
              </View>
            </View>
          ))}
          <Text style={s.nextReview}>Next scheduled review: October 2026</Text>
        </GlassmorphicCard>

        {/* Legal Contacts */}
        <Text style={s.sectionLabel}>LEGAL CONTACTS</Text>
        {LEGAL_CONTACTS.map((c, i) => (
          <GlassmorphicCard key={i} style={s.card}>
            <Text style={s.legalContactName}>{c.name}</Text>
            <Text style={s.legalContactDetail}>{c.contact} · {c.phone}</Text>
            <Text style={s.legalContactHours}>{c.hours}</Text>
          </GlassmorphicCard>
        ))}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Action Required bar */}
      {pendingActions > 0 && (
        <View style={s.actionBar}>
          <Text style={s.actionBarText}>⚠️ {pendingActions} actions required before next class</Text>
          <TouchableOpacity style={s.actionBarBtn} onPress={() => Alert.alert('Pending Actions', `You have ${pendingActions} actions to complete.`)}>
            <Text style={s.actionBarBtnText}>Review Now</Text>
          </TouchableOpacity>
        </View>
      )}
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

  // Hero
  enterpriseBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: NexusRadius.full, paddingHorizontal: NexusSpacing.md, paddingVertical: NexusSpacing.xs, borderWidth: 1, borderColor: NexusColors.accentAmber, marginBottom: NexusSpacing.sm },
  enterpriseBadgeText: { fontSize: NexusFonts.sizes.xs, fontWeight: NexusFonts.weights.bold, color: NexusColors.accentAmber },
  contractTitle: { fontSize: NexusFonts.sizes.xl, fontWeight: NexusFonts.weights.extrabold, color: NexusColors.textPrimary, marginBottom: NexusSpacing.xs },
  contractDates: { fontSize: NexusFonts.sizes.sm, color: NexusColors.textSecondary, marginBottom: NexusSpacing.lg },
  scoreRow: { flexDirection: 'row', gap: NexusSpacing.lg, alignItems: 'flex-start' },
  scoreRing: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: NexusColors.accentEmerald, alignItems: 'center', justifyContent: 'center' },
  scoreNum: { fontSize: NexusFonts.sizes.lg, fontWeight: NexusFonts.weights.black, color: NexusColors.accentEmerald },
  scoreLabel: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textSecondary },
  obligationMatrix: { flex: 1, flexDirection: 'row', gap: NexusSpacing.sm },
  obligationCol: { flex: 1 },
  obligationParty: { fontSize: NexusFonts.sizes.xs, fontWeight: NexusFonts.weights.bold, color: NexusColors.accentAmber, marginBottom: 4 },
  obligationItem: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textSecondary, marginBottom: 2 },
  compliantBadge: { marginTop: 4, backgroundColor: 'rgba(16,185,129,0.15)', borderRadius: NexusRadius.full, paddingHorizontal: NexusSpacing.xs, paddingVertical: 2, borderWidth: 1, borderColor: NexusColors.accentEmerald, alignSelf: 'flex-start' },
  compliantText: { fontSize: 8, fontWeight: NexusFonts.weights.extrabold, color: NexusColors.accentEmerald },

  // Protection
  protectionTitle: { fontSize: NexusFonts.sizes.base, fontWeight: NexusFonts.weights.bold, color: NexusColors.textPrimary, marginBottom: NexusSpacing.xs },
  protectionDesc: { fontSize: NexusFonts.sizes.sm, color: NexusColors.textSecondary, marginBottom: NexusSpacing.sm },
  protectionAmount: { fontSize: NexusFonts.sizes['2xl'], fontWeight: NexusFonts.weights.black, color: NexusColors.accentAmber, marginBottom: NexusSpacing.xs },
  protectionExceptions: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textDisabled },

  // Accordion
  accordionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: NexusSpacing.sm },
  accordionLeft: { flex: 1 },
  accordionTitle: { fontSize: NexusFonts.sizes.base, fontWeight: NexusFonts.weights.semibold, color: NexusColors.textPrimary },
  accordionMeta: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textSecondary, marginTop: 2 },
  accordionRight: { flexDirection: 'row', alignItems: 'center', gap: NexusSpacing.sm },
  sigBadge: { backgroundColor: 'rgba(245,158,11,0.2)', borderRadius: NexusRadius.full, paddingHorizontal: NexusSpacing.sm, paddingVertical: 2, borderWidth: 1, borderColor: NexusColors.accentAmber },
  sigBadgeText: { fontSize: NexusFonts.sizes.xs, fontWeight: NexusFonts.weights.extrabold, color: NexusColors.accentAmber },
  badgeRow: { flexDirection: 'row', gap: NexusSpacing.xs, marginBottom: NexusSpacing.xs },
  badge: { backgroundColor: 'rgba(99,102,241,0.15)', borderRadius: NexusRadius.full, paddingHorizontal: NexusSpacing.sm, paddingVertical: 2, borderWidth: 1, borderColor: NexusColors.accentIndigo },
  badgeText: { fontSize: NexusFonts.sizes.xs, fontWeight: NexusFonts.weights.bold, color: NexusColors.accentIndigo },
  syllabusNote: { fontSize: NexusFonts.sizes.xs, color: NexusColors.accentCyan, marginBottom: NexusSpacing.xs },
  docActions: { flexDirection: 'row', gap: NexusSpacing.md, paddingVertical: NexusSpacing.sm },
  docBtn: { flex: 1, borderWidth: 1, borderColor: NexusColors.accentAmber, borderRadius: NexusRadius.md, paddingVertical: NexusSpacing.sm, alignItems: 'center' },
  docBtnText: { fontSize: NexusFonts.sizes.xs, fontWeight: NexusFonts.weights.semibold, color: NexusColors.accentAmber },

  // Alignment
  alignItem: { flexDirection: 'row', alignItems: 'flex-start', gap: NexusSpacing.sm, borderLeftWidth: 3, paddingLeft: NexusSpacing.md },
  alignText: { flex: 1, fontSize: NexusFonts.sizes.sm, color: NexusColors.textSecondary, lineHeight: 20 },

  // Amendments
  amendRow: { flexDirection: 'row', gap: NexusSpacing.md, paddingVertical: NexusSpacing.sm },
  amendDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: NexusColors.accentAmber, marginTop: 4 },
  amendInfo: { flex: 1 },
  amendDate: { fontSize: NexusFonts.sizes.xs, fontWeight: NexusFonts.weights.bold, color: NexusColors.accentAmber },
  amendSummary: { fontSize: NexusFonts.sizes.sm, fontWeight: NexusFonts.weights.semibold, color: NexusColors.textPrimary, marginTop: 2 },
  amendMeta: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textSecondary, marginTop: 2 },
  nextReview: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textDisabled, marginTop: NexusSpacing.sm, fontStyle: 'italic' },

  // Legal contacts
  legalContactName: { fontSize: NexusFonts.sizes.base, fontWeight: NexusFonts.weights.bold, color: NexusColors.textPrimary },
  legalContactDetail: { fontSize: NexusFonts.sizes.sm, color: NexusColors.textSecondary, marginTop: 2 },
  legalContactHours: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textDisabled, marginTop: 2 },

  // Action bar
  actionBar: { backgroundColor: 'rgba(245,158,11,0.15)', borderTopWidth: 1, borderTopColor: NexusColors.accentAmber, padding: NexusSpacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: NexusSpacing.md },
  actionBarText: { flex: 1, fontSize: NexusFonts.sizes.sm, fontWeight: NexusFonts.weights.semibold, color: NexusColors.accentAmber },
  actionBarBtn: { backgroundColor: NexusColors.accentAmber, borderRadius: NexusRadius.md, paddingHorizontal: NexusSpacing.md, paddingVertical: NexusSpacing.sm },
  actionBarBtnText: { fontSize: NexusFonts.sizes.sm, fontWeight: NexusFonts.weights.extrabold, color: NexusColors.bgPrimary },
});
