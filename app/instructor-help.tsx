import React, { useState } from 'react';
import {
  Alert, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { GlassmorphicCard, NexusStatusBar } from '@/components/nexus';
import { NexusColors, NexusFonts, NexusSpacing, NexusRadius } from '@/constants/theme';

const TIERS = [
  { tier: 'Tier 1', label: 'Self-Service', eta: 'Immediate', pct: '80% of issues', color: NexusColors.accentCyan, contact: 'Use the in-app help center and knowledge base.' },
  { tier: 'Tier 2', label: 'IT Help Desk', eta: '< 4 hours', pct: '15%', color: NexusColors.accentIndigo, contact: 'Email: it@university.edu · Phone: x5555' },
  { tier: 'Tier 3', label: 'Nexus Enterprise', eta: '< 1 hour', pct: '5%', color: NexusColors.accentAmber, contact: 'Dedicated rep: Sarah Chen · sarah@nexus.app · 24/7' },
];

const TASKS = [
  { icon: '🎯', label: 'Set Up Geofence', time: '5 min' },
  { icon: '📊', label: 'Generate Report', time: '3 min' },
  { icon: '⚠️', label: 'Review Alerts', time: '10 min', badge: '3' },
  { icon: '👥', label: 'Manage TAs', time: '8 min' },
];

const MODULES = ['Basics ✓', 'Geofencing ✓', 'Analytics →', 'Compliance'];

const WORKSHOPS = [
  { title: 'Advanced Fraud Detection', when: 'Next Tuesday 2pm', format: 'Live Webinar', spots: '12 spots', badge: null },
  { title: 'FERPA Compliance Update', when: 'On-demand', format: '45 min', spots: null, badge: 'NEW' },
];

const TOOLS = [
  { icon: '🔧', label: 'Bulk Attendance Correction', risk: 'HIGH RISK', riskColor: NexusColors.accentRose, borderColor: NexusColors.accentRose, desc: 'Requires approval from department head' },
  { icon: '📥', label: 'LMS Integration', risk: 'AVAILABLE', riskColor: NexusColors.accentCyan, borderColor: NexusColors.accentCyan, desc: 'Connect to Canvas, Blackboard, Moodle' },
  { icon: '🔐', label: 'Emergency Override', risk: 'CRITICAL', riskColor: NexusColors.accentRose, borderColor: NexusColors.accentRose, desc: 'Audit log required. Use only in emergencies.' },
];

const CONTACTS = [
  { name: 'Mike Ross', role: 'Department IT', phone: 'x5555', hours: 'Mon-Fri 8-6', preferred: true },
  { name: 'Sarah Chen', role: 'Nexus Enterprise Rep', phone: '24/7 Priority', hours: 'Dedicated', preferred: false },
  { name: 'General Line', role: 'Registrar Data Office', phone: 'x4444', hours: 'Mon-Fri 9-5', preferred: false },
];

const KB_CHIPS = ['Policy', 'Technical', 'Pedagogy', 'Compliance'];
const KB_TRENDING = ['How to set geofence radius', 'Export attendance CSV', 'FERPA compliance checklist'];

export default function InstructorHelpScreen() {
  const [kbSearch, setKbSearch] = useState('');
  const [activeChip, setActiveChip] = useState<string | null>(null);

  return (
    <View style={s.root}>
      <NexusStatusBar gpsState="active" ntpSynced />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={22} color={NexusColors.accentIndigo} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>INSTRUCTOR SUPPORT CENTER</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Support Tier Visualizer */}
        <Text style={s.sectionLabel}>SUPPORT TIERS</Text>
        <GlassmorphicCard style={s.card}>
          <View style={s.tierRow}>
            {TIERS.map((tier, i) => (
              <React.Fragment key={i}>
                <TouchableOpacity style={s.tierItem} onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  Alert.alert(tier.label, tier.contact);
                }}>
                  <View style={[s.tierCircle, { borderColor: tier.color }]}>
                    <Text style={[s.tierNum, { color: tier.color }]}>{tier.tier}</Text>
                  </View>
                  <Text style={s.tierLabel}>{tier.label}</Text>
                  <Text style={s.tierEta}>{tier.eta}</Text>
                  <Text style={s.tierPct}>{tier.pct}</Text>
                </TouchableOpacity>
                {i < TIERS.length - 1 && <Text style={s.tierArrow}>→</Text>}
              </React.Fragment>
            ))}
          </View>
        </GlassmorphicCard>

        {/* Common Tasks */}
        <Text style={s.sectionLabel}>COMMON TASKS</Text>
        <GlassmorphicCard style={s.card}>
          <View style={s.taskGrid}>
            {TASKS.map((task, i) => (
              <TouchableOpacity key={i} style={s.taskCell} onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                Alert.alert(task.label, `Estimated time: ${task.time}`);
              }}>
                <View style={s.taskIconWrap}>
                  <Text style={s.taskIcon}>{task.icon}</Text>
                  {task.badge && <View style={s.taskBadge}><Text style={s.taskBadgeText}>{task.badge}</Text></View>}
                </View>
                <Text style={s.taskLabel}>{task.label}</Text>
                <Text style={s.taskTime}>{task.time}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </GlassmorphicCard>

        {/* Training & Certification */}
        <Text style={s.sectionLabel}>TRAINING & CERTIFICATION</Text>
        <GlassmorphicCard glowColor={NexusColors.accentIndigo} style={s.card}>
          <Text style={s.certTitle}>🎓 Nexus Certified Instructor</Text>
          <View style={s.certProgressRow}>
            <View style={s.certTrack}>
              <View style={[s.certFill, { width: '65%' }]} />
            </View>
            <Text style={s.certPct}>65%</Text>
          </View>
          <View style={s.moduleRow}>
            {MODULES.map((m, i) => (
              <View key={i} style={[s.moduleChip, m.includes('→') && { borderColor: NexusColors.accentIndigo }]}>
                <Text style={[s.moduleText, m.includes('→') && { color: NexusColors.accentIndigo }]}>{m}</Text>
              </View>
            ))}
          </View>
          <Text style={s.certValidity}>Valid for 2 years</Text>
          <View style={s.divider} />
          {WORKSHOPS.map((w, i) => (
            <View key={i} style={[s.workshopRow, i < WORKSHOPS.length - 1 && s.divider]}>
              <View style={s.workshopInfo}>
                <Text style={s.workshopTitle}>{w.title}</Text>
                <Text style={s.workshopMeta}>{w.when} · {w.format}{w.spots ? ` · ${w.spots}` : ''}</Text>
              </View>
              {w.badge && <View style={s.newBadge}><Text style={s.newBadgeText}>{w.badge}</Text></View>}
            </View>
          ))}
        </GlassmorphicCard>

        {/* Administrative Tools */}
        <Text style={s.sectionLabel}>ADMINISTRATIVE TOOLS</Text>
        {TOOLS.map((tool, i) => (
          <GlassmorphicCard key={i} style={[s.card, { borderColor: tool.borderColor, borderWidth: 1 }]}>
            <View style={s.toolRow}>
              <Text style={s.toolIcon}>{tool.icon}</Text>
              <View style={s.toolInfo}>
                <Text style={s.toolLabel}>{tool.label}</Text>
                <Text style={s.toolDesc}>{tool.desc}</Text>
              </View>
              <View style={[s.riskBadge, { backgroundColor: tool.riskColor + '22', borderColor: tool.riskColor }]}>
                <Text style={[s.riskText, { color: tool.riskColor }]}>{tool.risk}</Text>
              </View>
            </View>
            <TouchableOpacity style={[s.toolBtn, { borderColor: tool.borderColor }]} onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
              if (tool.risk === 'HIGH RISK' || tool.risk === 'CRITICAL') {
                Alert.alert(`⚠️ ${tool.risk}`, `${tool.desc}\n\nAre you sure you want to proceed?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Proceed', style: 'destructive' }]);
              } else {
                Alert.alert(tool.label, tool.desc);
              }
            }}>
              <Text style={[s.toolBtnText, { color: tool.riskColor }]}>Open Tool</Text>
            </TouchableOpacity>
          </GlassmorphicCard>
        ))}

        {/* Institutional Contacts */}
        <Text style={s.sectionLabel}>INSTITUTIONAL CONTACTS</Text>
        {CONTACTS.map((c, i) => (
          <GlassmorphicCard key={i} style={s.card}>
            <View style={s.contactRow}>
              <View style={s.contactAvatar}>
                <Text style={s.contactInitial}>{c.name[0]}</Text>
              </View>
              <View style={s.contactInfo}>
                <View style={s.contactNameRow}>
                  <Text style={s.contactName}>{c.name}</Text>
                  {c.preferred && <View style={s.preferredBadge}><Text style={s.preferredText}>PREFERRED</Text></View>}
                </View>
                <Text style={s.contactRole}>{c.role}</Text>
                <Text style={s.contactMeta}>{c.phone} · {c.hours}</Text>
              </View>
            </View>
          </GlassmorphicCard>
        ))}

        {/* Knowledge Base */}
        <Text style={s.sectionLabel}>KNOWLEDGE BASE</Text>
        <GlassmorphicCard style={s.card}>
          <View style={s.kbSearchRow}>
            <Ionicons name="search" size={16} color={NexusColors.textSecondary} />
            <TextInput style={s.kbInput} value={kbSearch} onChangeText={setKbSearch} placeholder="Search knowledge base..." placeholderTextColor={NexusColors.textDisabled} />
          </View>
          <View style={s.chipRow}>
            {KB_CHIPS.map(chip => (
              <TouchableOpacity key={chip} style={[s.chip, activeChip === chip && { borderColor: NexusColors.accentIndigo, backgroundColor: 'rgba(99,102,241,0.15)' }]} onPress={() => setActiveChip(activeChip === chip ? null : chip)}>
                <Text style={[s.chipText, activeChip === chip && { color: NexusColors.accentIndigo }]}>{chip}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={s.divider} />
          {KB_TRENDING.map((topic, i) => (
            <TouchableOpacity key={i} style={s.kbTopic} onPress={() => Alert.alert('Article', topic)}>
              <Ionicons name="document-text-outline" size={14} color={NexusColors.textSecondary} />
              <Text style={s.kbTopicText}>{topic}</Text>
            </TouchableOpacity>
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
  headerTitle: { fontSize: NexusFonts.sizes.xs, fontWeight: NexusFonts.weights.bold, color: NexusColors.textPrimary, letterSpacing: NexusFonts.letterSpacing.widest },
  scroll: { padding: NexusSpacing.lg },
  card: { padding: NexusSpacing.lg, marginBottom: NexusSpacing.md },
  sectionLabel: { fontSize: NexusFonts.sizes.xs, fontWeight: NexusFonts.weights.bold, color: NexusColors.textSecondary, letterSpacing: NexusFonts.letterSpacing.widest, marginBottom: NexusSpacing.sm, marginTop: NexusSpacing.sm },
  divider: { height: 1, backgroundColor: NexusColors.borderGlass, marginVertical: NexusSpacing.sm },

  // Tiers
  tierRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tierItem: { flex: 1, alignItems: 'center', gap: 4 },
  tierCircle: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tierNum: { fontSize: NexusFonts.sizes.xs, fontWeight: NexusFonts.weights.extrabold },
  tierLabel: { fontSize: NexusFonts.sizes.xs, fontWeight: NexusFonts.weights.bold, color: NexusColors.textPrimary, textAlign: 'center' },
  tierEta: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textSecondary, textAlign: 'center' },
  tierPct: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textDisabled, textAlign: 'center' },
  tierArrow: { fontSize: 18, color: NexusColors.textDisabled, paddingHorizontal: 4 },

  // Tasks
  taskGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  taskCell: { width: '50%', padding: NexusSpacing.md, alignItems: 'center', gap: 4 },
  taskIconWrap: { position: 'relative' },
  taskIcon: { fontSize: 28 },
  taskBadge: { position: 'absolute', top: -4, right: -8, backgroundColor: NexusColors.accentRose, borderRadius: NexusRadius.full, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  taskBadgeText: { fontSize: NexusFonts.sizes.xs, fontWeight: NexusFonts.weights.bold, color: NexusColors.textPrimary },
  taskLabel: { fontSize: NexusFonts.sizes.sm, fontWeight: NexusFonts.weights.semibold, color: NexusColors.textPrimary, textAlign: 'center' },
  taskTime: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textSecondary },

  // Cert
  certTitle: { fontSize: NexusFonts.sizes.lg, fontWeight: NexusFonts.weights.bold, color: NexusColors.textPrimary, marginBottom: NexusSpacing.sm },
  certProgressRow: { flexDirection: 'row', alignItems: 'center', gap: NexusSpacing.sm, marginBottom: NexusSpacing.md },
  certTrack: { flex: 1, height: 8, backgroundColor: NexusColors.bgCardSolid, borderRadius: NexusRadius.full, overflow: 'hidden' },
  certFill: { height: '100%', backgroundColor: NexusColors.accentIndigo, borderRadius: NexusRadius.full },
  certPct: { fontSize: NexusFonts.sizes.sm, fontWeight: NexusFonts.weights.bold, color: NexusColors.accentIndigo },
  moduleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: NexusSpacing.sm, marginBottom: NexusSpacing.sm },
  moduleChip: { borderRadius: NexusRadius.full, paddingHorizontal: NexusSpacing.md, paddingVertical: NexusSpacing.xs, borderWidth: 1, borderColor: NexusColors.borderGlass },
  moduleText: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textSecondary },
  certValidity: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textDisabled, marginBottom: NexusSpacing.sm },
  workshopRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: NexusSpacing.sm },
  workshopInfo: { flex: 1 },
  workshopTitle: { fontSize: NexusFonts.sizes.sm, fontWeight: NexusFonts.weights.semibold, color: NexusColors.textPrimary },
  workshopMeta: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textSecondary, marginTop: 2 },
  newBadge: { backgroundColor: NexusColors.accentAmber, borderRadius: NexusRadius.full, paddingHorizontal: NexusSpacing.sm, paddingVertical: 2 },
  newBadgeText: { fontSize: NexusFonts.sizes.xs, fontWeight: NexusFonts.weights.bold, color: NexusColors.bgPrimary },

  // Tools
  toolRow: { flexDirection: 'row', alignItems: 'center', gap: NexusSpacing.md, marginBottom: NexusSpacing.md },
  toolIcon: { fontSize: 24 },
  toolInfo: { flex: 1 },
  toolLabel: { fontSize: NexusFonts.sizes.base, fontWeight: NexusFonts.weights.bold, color: NexusColors.textPrimary },
  toolDesc: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textSecondary, marginTop: 2 },
  riskBadge: { borderRadius: NexusRadius.full, paddingHorizontal: NexusSpacing.sm, paddingVertical: 2, borderWidth: 1 },
  riskText: { fontSize: NexusFonts.sizes.xs, fontWeight: NexusFonts.weights.extrabold },
  toolBtn: { borderWidth: 1, borderRadius: NexusRadius.md, paddingVertical: NexusSpacing.sm, alignItems: 'center' },
  toolBtnText: { fontSize: NexusFonts.sizes.sm, fontWeight: NexusFonts.weights.bold },

  // Contacts
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: NexusSpacing.md },
  contactAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(99,102,241,0.2)', alignItems: 'center', justifyContent: 'center' },
  contactInitial: { fontSize: NexusFonts.sizes.lg, fontWeight: NexusFonts.weights.bold, color: NexusColors.accentIndigo },
  contactInfo: { flex: 1 },
  contactNameRow: { flexDirection: 'row', alignItems: 'center', gap: NexusSpacing.sm },
  contactName: { fontSize: NexusFonts.sizes.base, fontWeight: NexusFonts.weights.bold, color: NexusColors.textPrimary },
  contactRole: { fontSize: NexusFonts.sizes.sm, color: NexusColors.textSecondary, marginTop: 2 },
  contactMeta: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textDisabled, marginTop: 2 },
  preferredBadge: { backgroundColor: 'rgba(16,185,129,0.15)', borderRadius: NexusRadius.full, paddingHorizontal: NexusSpacing.sm, paddingVertical: 2, borderWidth: 1, borderColor: NexusColors.accentEmerald },
  preferredText: { fontSize: NexusFonts.sizes.xs, fontWeight: NexusFonts.weights.bold, color: NexusColors.accentEmerald },

  // KB
  kbSearchRow: { flexDirection: 'row', alignItems: 'center', gap: NexusSpacing.sm, borderWidth: 1, borderColor: NexusColors.borderGlass, borderRadius: NexusRadius.md, paddingHorizontal: NexusSpacing.md, paddingVertical: NexusSpacing.sm, marginBottom: NexusSpacing.md },
  kbInput: { flex: 1, fontSize: NexusFonts.sizes.base, color: NexusColors.textPrimary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: NexusSpacing.sm },
  chip: { backgroundColor: NexusColors.bgCardSolid, borderRadius: NexusRadius.full, paddingHorizontal: NexusSpacing.md, paddingVertical: NexusSpacing.xs, borderWidth: 1, borderColor: NexusColors.borderGlass },
  chipText: { fontSize: NexusFonts.sizes.xs, color: NexusColors.textSecondary },
  kbTopic: { flexDirection: 'row', alignItems: 'center', gap: NexusSpacing.sm, paddingVertical: NexusSpacing.sm },
  kbTopicText: { fontSize: NexusFonts.sizes.sm, color: NexusColors.textSecondary },
});
