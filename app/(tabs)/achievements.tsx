/**
 * Achievement Gallery — Full-screen badge showcase
 * Shows all earned and locked badges with animated reveals.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { GlassmorphicCard, NexusStatusBar } from '@/components/nexus';
import { NexusColors, NexusFonts, NexusSpacing, NexusRadius } from '@/constants/theme';
import NexusLoader from '@/components/NexusLoader';

interface Badge {
  id: string;
  icon: string;
  title: string;
  description: string;
  category: 'attendance' | 'streak' | 'social' | 'special';
  earned: boolean;
  earnedAt?: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  nxsReward: number;
}

const RARITY_COLORS: Record<string, string> = {
  common:    NexusColors.textSecondary,
  rare:      NexusColors.accentCyan,
  epic:      NexusColors.accentIndigo,
  legendary: NexusColors.accentAmber,
};

const ALL_BADGES: Badge[] = [
  // Attendance
  { id: 'first_checkin',   icon: '📍', title: 'First Step',       description: 'Mark your first attendance',          category: 'attendance', earned: true,  rarity: 'common',    nxsReward: 10,  earnedAt: '2024-09-02' },
  { id: 'perfect_week',    icon: '🏆', title: 'Perfect Week',     description: '7 consecutive days of attendance',    category: 'streak',     earned: true,  rarity: 'rare',      nxsReward: 50,  earnedAt: '2024-09-09' },
  { id: 'early_bird',      icon: '⏰', title: 'Early Bird',       description: 'Check in 10+ min before class starts', category: 'attendance', earned: true,  rarity: 'common',    nxsReward: 5   },
  { id: 'marathoner',      icon: '🏃', title: 'Marathoner',       description: '30-day attendance streak',            category: 'streak',     earned: false, rarity: 'epic',      nxsReward: 200 },
  { id: 'on_target',       icon: '🎯', title: 'On Target',        description: 'Maintain 80%+ attendance rate',       category: 'attendance', earned: true,  rarity: 'rare',      nxsReward: 75,  earnedAt: '2024-10-01' },
  { id: 'century',         icon: '💯', title: 'Century',          description: '100 total check-ins',                 category: 'attendance', earned: false, rarity: 'epic',      nxsReward: 150 },
  // Streak
  { id: 'streak_7',        icon: '🔥', title: 'Week Warrior',     description: '7-day streak',                        category: 'streak',     earned: true,  rarity: 'common',    nxsReward: 30,  earnedAt: '2024-09-09' },
  { id: 'streak_30',       icon: '⚡', title: 'Lightning Rod',    description: '30-day streak',                       category: 'streak',     earned: false, rarity: 'epic',      nxsReward: 200 },
  { id: 'streak_100',      icon: '🌟', title: 'Supernova',        description: '100-day streak',                      category: 'streak',     earned: false, rarity: 'legendary', nxsReward: 1000 },
  // Social
  { id: 'campus_pulse',    icon: '📡', title: 'Campus Pulse',     description: 'Contribute to Campus Pulse 10 times', category: 'social',     earned: true,  rarity: 'common',    nxsReward: 20,  earnedAt: '2024-09-15' },
  { id: 'ghost_mode',      icon: '👻', title: 'Ghost Protocol',   description: 'Use Ghost Mode 5 times',              category: 'social',     earned: false, rarity: 'rare',      nxsReward: 40  },
  // Special
  { id: 'nexus_pioneer',   icon: '🚀', title: 'Nexus Pioneer',    description: 'First 100 users on the platform',     category: 'special',    earned: true,  rarity: 'legendary', nxsReward: 500, earnedAt: '2024-09-01' },
  { id: 'ar_explorer',     icon: '🔭', title: 'AR Explorer',      description: 'Use AR Classroom Finder 3 times',     category: 'special',    earned: false, rarity: 'epic',      nxsReward: 100 },
  { id: 'echo_master',     icon: '🎙️', title: 'Echo Master',      description: 'Use 20 voice commands',               category: 'special',    earned: false, rarity: 'rare',      nxsReward: 60  },
  { id: 'time_traveler',   icon: '⏳', title: 'Time Traveler',    description: 'Replay 5 sessions in Chronos',        category: 'special',    earned: false, rarity: 'epic',      nxsReward: 80  },
  { id: 'offline_warrior', icon: '📶', title: 'Offline Warrior',  description: 'Sync 10 offline attendance records',  category: 'special',    earned: false, rarity: 'rare',      nxsReward: 50  },
];

const CATEGORIES = ['all', 'attendance', 'streak', 'social', 'special'] as const;
type Category = typeof CATEGORIES[number];

function BadgeCard({ badge, index }: { badge: Badge; index: number }) {
  const scale   = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const glow    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale,   { toValue: 1, friction: 6, tension: 50, delay: index * 60, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 300, delay: index * 60, useNativeDriver: true }),
    ]).start();

    if (badge.earned) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0.3, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    }
  }, []);

  const rarityColor = RARITY_COLORS[badge.rarity];

  const handlePress = () => {
    if (badge.earned) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  return (
    <Animated.View style={[s.badgeWrap, { opacity, transform: [{ scale }] }]}>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.85}>
        <View style={[
          s.badgeCard,
          badge.earned ? s.badgeCardEarned : s.badgeCardLocked,
          { borderColor: badge.earned ? rarityColor : NexusColors.borderGlass },
        ]}>
          {/* Glow halo for earned */}
          {badge.earned && (
            <Animated.View style={[s.badgeGlow, { backgroundColor: rarityColor, opacity: glow }]} />
          )}

          {/* Rarity indicator */}
          <View style={[s.rarityDot, { backgroundColor: rarityColor }]} />

          {/* Icon */}
          <Text style={[s.badgeIcon, !badge.earned && s.badgeIconLocked]}>
            {badge.earned ? badge.icon : '🔒'}
          </Text>

          {/* Title */}
          <Text style={[s.badgeTitle, !badge.earned && s.badgeTitleLocked]}>
            {badge.title}
          </Text>

          {/* Description */}
          <Text style={s.badgeDesc} numberOfLines={2}>{badge.description}</Text>

          {/* NXS reward */}
          <View style={s.nxsRow}>
            <Text style={s.nxsIcon}>🪙</Text>
            <Text style={[s.nxsAmount, { color: badge.earned ? NexusColors.accentAmber : NexusColors.textDisabled }]}>
              {badge.nxsReward} NXS
            </Text>
          </View>

          {/* Earned date */}
          {badge.earned && badge.earnedAt && (
            <Text style={s.earnedDate}>
              {new Date(badge.earnedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function AchievementsScreen() {
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]         = useState<Category>('all');
  const [badges, setBadges]         = useState(ALL_BADGES);

  const earnedCount = badges.filter(b => b.earned).length;
  const totalNXS    = badges.filter(b => b.earned).reduce((s, b) => s + b.nxsReward, 0);

  const filtered = filter === 'all' ? badges : badges.filter(b => b.category === filter);

  if (loading) return <NexusLoader label="LOADING ACHIEVEMENTS..." />;

  return (
    <View style={s.root}>
      <NexusStatusBar gpsState="active" ntpSynced />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={NexusColors.textSecondary} />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>ACHIEVEMENT GALLERY</Text>
          <Text style={s.headerSub}>{earnedCount}/{badges.length} unlocked · {totalNXS} NXS earned</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={s.progressWrap}>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${Math.round((earnedCount / badges.length) * 100)}%` as any }]} />
        </View>
        <Text style={s.progressPct}>{Math.round((earnedCount / badges.length) * 100)}%</Text>
      </View>

      {/* Category filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[s.filterChip, filter === cat && s.filterChipActive]}
            onPress={() => { setFilter(cat); Haptics.selectionAsync().catch(() => {}); }}
            activeOpacity={0.8}
          >
            <Text style={[s.filterChipText, filter === cat && s.filterChipTextActive]}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Badge grid */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.grid}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(false)} tintColor={NexusColors.accentCyan} />
        }
      >
        <View style={s.gridRow}>
          {filtered.map((badge, i) => (
            <BadgeCard key={badge.id} badge={badge} index={i} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: NexusColors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.lg,
    paddingHorizontal: NexusSpacing.xl,
    paddingTop: NexusSpacing.lg,
    paddingBottom: NexusSpacing.md,
  },
  backBtn: { padding: NexusSpacing.xs },
  headerTitle: {
    fontSize: NexusFonts.sizes.sm,
    fontWeight: NexusFonts.weights.black,
    color: NexusColors.textPrimary,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
  headerSub: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
    marginTop: 2,
  },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.md,
    paddingHorizontal: NexusSpacing.xl,
    marginBottom: NexusSpacing.md,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: NexusColors.borderGlass,
    borderRadius: NexusRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: NexusColors.accentAmber,
    borderRadius: NexusRadius.full,
  },
  progressPct: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.accentAmber,
    minWidth: 32,
    textAlign: 'right',
  },
  filterRow: {
    paddingHorizontal: NexusSpacing.xl,
    gap: NexusSpacing.sm,
    paddingBottom: NexusSpacing.md,
  },
  filterChip: {
    paddingHorizontal: NexusSpacing.lg,
    paddingVertical: NexusSpacing.sm,
    borderRadius: NexusRadius.full,
    borderWidth: 1,
    borderColor: NexusColors.borderGlass,
    backgroundColor: NexusColors.bgCard,
  },
  filterChipActive: {
    borderColor: NexusColors.accentAmber,
    backgroundColor: 'rgba(245,158,11,0.12)',
  },
  filterChipText: {
    fontSize: NexusFonts.sizes.sm,
    fontWeight: NexusFonts.weights.semibold,
    color: NexusColors.textSecondary,
  },
  filterChipTextActive: { color: NexusColors.accentAmber },
  grid: {
    paddingHorizontal: NexusSpacing.lg,
    paddingBottom: NexusSpacing['3xl'],
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: NexusSpacing.md,
  },
  badgeWrap: { width: '47%' },
  badgeCard: {
    borderRadius: NexusRadius.xl,
    borderWidth: 1,
    padding: NexusSpacing.lg,
    gap: NexusSpacing.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  badgeCardEarned: { backgroundColor: NexusColors.bgCard },
  badgeCardLocked: { backgroundColor: 'rgba(15,23,42,0.6)' },
  badgeGlow: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.06,
  },
  rarityDot: {
    position: 'absolute',
    top: NexusSpacing.md,
    right: NexusSpacing.md,
    width: 6, height: 6, borderRadius: 3,
  },
  badgeIcon: { fontSize: 32 },
  badgeIconLocked: { opacity: 0.4 },
  badgeTitle: {
    fontSize: NexusFonts.sizes.sm,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textPrimary,
  },
  badgeTitleLocked: { color: NexusColors.textDisabled },
  badgeDesc: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
    lineHeight: 16,
  },
  nxsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  nxsIcon: { fontSize: 11 },
  nxsAmount: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.bold,
  },
  earnedDate: {
    fontSize: 9,
    color: NexusColors.textDisabled,
    letterSpacing: NexusFonts.letterSpacing.wide,
  },
});
