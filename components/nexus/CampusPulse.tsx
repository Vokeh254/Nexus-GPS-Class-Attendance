/**
 * CampusPulse — Social attendance energy widget
 * Shows live campus check-in count, energy level, hotspot heatmap,
 * and the student's streak contribution.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { NexusColors, NexusFonts, NexusSpacing, NexusRadius } from '@/constants/theme';

interface HotSpot {
  name: string;
  count: number;
  emoji: string;
  hot: boolean;
}

interface Props {
  streakDays: number;
}

// Energy level thresholds
function getEnergyLevel(pct: number): { label: string; color: string; emoji: string } {
  if (pct >= 85) return { label: 'ELECTRIC', color: NexusColors.accentCyan,    emoji: '⚡' };
  if (pct >= 65) return { label: 'BUZZING',  color: NexusColors.accentEmerald, emoji: '🔥' };
  if (pct >= 40) return { label: 'ACTIVE',   color: NexusColors.accentAmber,   emoji: '✨' };
  return           { label: 'QUIET',   color: NexusColors.textSecondary, emoji: '🌙' };
}

const DEMO_HOTSPOTS: HotSpot[] = [
  { name: 'CS Building',  count: 312, emoji: '💻', hot: true  },
  { name: 'Library',      count: 234, emoji: '📚', hot: false },
  { name: 'Lecture Hall', count: 189, emoji: '🎓', hot: false },
  { name: 'Gym',          count: 89,  emoji: '🏋️', hot: false },
];

export default function CampusPulse({ streakDays }: Props) {
  const [totalCheckedIn, setTotalCheckedIn] = useState(1247);
  const [totalStudents]  = useState(1432);
  const [hotspots]       = useState<HotSpot[]>(DEMO_HOTSPOTS);

  // Pulsing dot animation
  const pulseScale   = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseScale,   { toValue: 1.4, duration: 900, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseScale,   { toValue: 1,   duration: 900, easing: Easing.in(Easing.ease),  useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, { toValue: 0.2, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.8, duration: 900, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  // Fetch real count from Supabase (today's attendance_logs)
  useEffect(() => {
    const fetchCount = async () => {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const { count } = await supabase
        .from('attendance_logs')
        .select('*', { count: 'exact', head: true })
        .gte('signed_at', todayStart.toISOString());
      if (count && count > 0) setTotalCheckedIn(count);
    };
    fetchCount();
  }, []);

  const pct = Math.round((totalCheckedIn / totalStudents) * 100);
  const energy = getEnergyLevel(pct);

  const handleShare = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    // Placeholder — real share would use expo-sharing
  };

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.liveRow}>
          <Animated.View style={[s.liveDot, { transform: [{ scale: pulseScale }], opacity: pulseOpacity }]} />
          <Text style={s.liveText}>CAMPUS PULSE</Text>
        </View>
        <View style={[s.energyBadge, { borderColor: energy.color }]}>
          <Text style={[s.energyText, { color: energy.color }]}>
            {energy.emoji} {energy.label}
          </Text>
        </View>
      </View>

      {/* Big count */}
      <View style={s.countRow}>
        <Text style={s.countBig}>{totalCheckedIn.toLocaleString()}</Text>
        <Text style={s.countSub}>/{totalStudents.toLocaleString()} students checked in today</Text>
      </View>

      {/* Progress bar */}
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${pct}%` as any, backgroundColor: energy.color }]} />
      </View>
      <Text style={[s.pctLabel, { color: energy.color }]}>{pct}% campus attendance</Text>

      {/* Hotspot list */}
      <View style={s.hotspots}>
        {hotspots.map((spot) => (
          <View key={spot.name} style={s.hotspotRow}>
            <Text style={s.hotspotEmoji}>{spot.emoji}</Text>
            <Text style={s.hotspotName}>{spot.name}</Text>
            {spot.hot && (
              <View style={s.hotBadge}>
                <Text style={s.hotBadgeText}>🔥 HOT</Text>
              </View>
            )}
            <Text style={s.hotspotCount}>{spot.count}</Text>
          </View>
        ))}
      </View>

      {/* Footer */}
      <View style={s.footer}>
        <Text style={s.footerContrib}>
          Your contribution: <Text style={s.footerStreak}>+{streakDays} streak days 🏆</Text>
        </Text>
        <TouchableOpacity style={s.shareBtn} onPress={handleShare} activeOpacity={0.8}>
          <Text style={s.shareBtnText}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    gap: NexusSpacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.sm,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: NexusColors.accentRose,
  },
  liveText: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.black,
    color: NexusColors.textSecondary,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
  energyBadge: {
    borderWidth: 1,
    borderRadius: NexusRadius.full,
    paddingHorizontal: NexusSpacing.md,
    paddingVertical: 3,
  },
  energyText: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.bold,
    letterSpacing: NexusFonts.letterSpacing.wide,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: NexusSpacing.sm,
    flexWrap: 'wrap',
  },
  countBig: {
    fontSize: NexusFonts.sizes['3xl'],
    fontWeight: NexusFonts.weights.black,
    color: NexusColors.textPrimary,
  },
  countSub: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
    flex: 1,
  },
  progressTrack: {
    height: 4,
    backgroundColor: NexusColors.borderGlass,
    borderRadius: NexusRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: NexusRadius.full,
  },
  pctLabel: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.semibold,
    letterSpacing: NexusFonts.letterSpacing.wide,
  },
  hotspots: {
    gap: NexusSpacing.sm,
    paddingTop: NexusSpacing.xs,
    borderTopWidth: 1,
    borderTopColor: NexusColors.borderGlass,
  },
  hotspotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.sm,
  },
  hotspotEmoji: { fontSize: 14 },
  hotspotName: {
    flex: 1,
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.textSecondary,
    fontWeight: NexusFonts.weights.medium,
  },
  hotBadge: {
    backgroundColor: 'rgba(244,63,94,0.12)',
    borderRadius: NexusRadius.sm,
    paddingHorizontal: NexusSpacing.sm,
    paddingVertical: 2,
  },
  hotBadgeText: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.accentRose,
    fontWeight: NexusFonts.weights.bold,
  },
  hotspotCount: {
    fontSize: NexusFonts.sizes.sm,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textPrimary,
    minWidth: 32,
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: NexusSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: NexusColors.borderGlass,
  },
  footerContrib: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
    flex: 1,
  },
  footerStreak: {
    color: NexusColors.accentAmber,
    fontWeight: NexusFonts.weights.bold,
  },
  shareBtn: {
    backgroundColor: 'rgba(6,182,212,0.12)',
    borderWidth: 1,
    borderColor: NexusColors.borderGlow,
    borderRadius: NexusRadius.full,
    paddingHorizontal: NexusSpacing.lg,
    paddingVertical: NexusSpacing.xs,
  },
  shareBtnText: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.accentCyan,
    letterSpacing: NexusFonts.letterSpacing.wide,
  },
});
