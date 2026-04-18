/**
 * NexusCoinsWallet — Attendance economy display
 * Shows NXS balance, recent earnings, and spend categories.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { NexusColors, NexusFonts, NexusSpacing, NexusRadius } from '@/constants/theme';

interface Earning {
  label: string;
  amount: number;
  icon: string;
}

interface Props {
  streakDays: number;
  attendanceRate: number; // 0–100
}

function computeBalance(streakDays: number, attendanceRate: number): number {
  const streakBonus  = streakDays * 10;
  const rateBonus    = Math.floor(attendanceRate / 10) * 5;
  const perfectWeeks = Math.floor(streakDays / 7) * 50;
  return streakBonus + rateBonus + perfectWeeks;
}

function getEarnings(streakDays: number): Earning[] {
  const list: Earning[] = [
    { label: 'On-time attendance', amount: 10, icon: '✅' },
  ];
  if (streakDays >= 7)  list.push({ label: 'Perfect week bonus', amount: 50, icon: '🏆' });
  if (streakDays >= 1)  list.push({ label: 'Early arrival bonus', amount: 5,  icon: '⏰' });
  return list;
}

export default function NexusCoinsWallet({ streakDays, attendanceRate }: Props) {
  const balance  = computeBalance(streakDays, attendanceRate);
  const earnings = getEarnings(streakDays);

  // Shimmer animation on the coin icon
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const shimmerOpacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  const SPEND_ITEMS = [
    { icon: '🎟️', label: 'Library booking' },
    { icon: '☕', label: 'Coffee discount' },
    { icon: '📚', label: 'Extended loan' },
  ];

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Animated.Text style={[s.coinIcon, { opacity: shimmerOpacity }]}>🪙</Animated.Text>
        <Text style={s.headerText}>NEXUS COINS</Text>
        <View style={s.betaBadge}>
          <Text style={s.betaText}>BETA</Text>
        </View>
      </View>

      {/* Balance */}
      <View style={s.balanceRow}>
        <Text style={s.balanceAmount}>{balance.toLocaleString()}</Text>
        <Text style={s.balanceCurrency}>NXS</Text>
      </View>

      {/* Recent earnings */}
      <View style={s.earningsSection}>
        <Text style={s.sectionLabel}>RECENT EARNINGS</Text>
        {earnings.map((e, i) => (
          <View key={i} style={s.earningRow}>
            <Text style={s.earningIcon}>{e.icon}</Text>
            <Text style={s.earningLabel}>{e.label}</Text>
            <Text style={s.earningAmount}>+{e.amount} NXS</Text>
          </View>
        ))}
      </View>

      {/* Spend categories */}
      <View style={s.spendSection}>
        <Text style={s.sectionLabel}>SPEND ON</Text>
        <View style={s.spendRow}>
          {SPEND_ITEMS.map((item) => (
            <View key={item.label} style={s.spendItem}>
              <Text style={s.spendIcon}>{item.icon}</Text>
              <Text style={s.spendLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: NexusSpacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.sm,
  },
  coinIcon: { fontSize: 18 },
  headerText: {
    flex: 1,
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.black,
    color: NexusColors.textSecondary,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
  betaBadge: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderWidth: 1,
    borderColor: NexusColors.accentAmber,
    borderRadius: NexusRadius.sm,
    paddingHorizontal: NexusSpacing.sm,
    paddingVertical: 2,
  },
  betaText: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.black,
    color: NexusColors.accentAmber,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: NexusSpacing.sm,
  },
  balanceAmount: {
    fontSize: NexusFonts.sizes['4xl'],
    fontWeight: NexusFonts.weights.black,
    color: NexusColors.accentAmber,
  },
  balanceCurrency: {
    fontSize: NexusFonts.sizes.lg,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textSecondary,
  },
  earningsSection: {
    gap: NexusSpacing.sm,
    paddingTop: NexusSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: NexusColors.borderGlass,
  },
  sectionLabel: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textDisabled,
    letterSpacing: NexusFonts.letterSpacing.widest,
    marginBottom: NexusSpacing.xs,
  },
  earningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.sm,
  },
  earningIcon: { fontSize: 14 },
  earningLabel: {
    flex: 1,
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.textSecondary,
    fontWeight: NexusFonts.weights.medium,
  },
  earningAmount: {
    fontSize: NexusFonts.sizes.sm,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.accentAmber,
  },
  spendSection: {
    gap: NexusSpacing.sm,
    paddingTop: NexusSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: NexusColors.borderGlass,
  },
  spendRow: {
    flexDirection: 'row',
    gap: NexusSpacing.md,
  },
  spendItem: {
    flex: 1,
    alignItems: 'center',
    gap: NexusSpacing.xs,
    backgroundColor: NexusColors.bgCardSolid,
    borderRadius: NexusRadius.md,
    padding: NexusSpacing.md,
    borderWidth: 1,
    borderColor: NexusColors.borderGlass,
  },
  spendIcon: { fontSize: 20 },
  spendLabel: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
    textAlign: 'center',
    fontWeight: NexusFonts.weights.medium,
  },
});
