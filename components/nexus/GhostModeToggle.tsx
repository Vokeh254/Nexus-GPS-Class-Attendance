/**
 * GhostModeToggle — Privacy-first attendance toggle
 * When enabled: student appears as "Present" only, no map pin, anonymous heatmap.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { NexusColors, NexusFonts, NexusSpacing, NexusRadius } from '@/constants/theme';

interface Props {
  enabled: boolean;
  onToggle: (value: boolean) => void;
}

export default function GhostModeToggle({ enabled, onToggle }: Props) {
  const trackColor = useRef(new Animated.Value(enabled ? 1 : 0)).current;
  const thumbX     = useRef(new Animated.Value(enabled ? 1 : 0)).current;
  const ghostOpacity = useRef(new Animated.Value(enabled ? 1 : 0.4)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(trackColor,    { toValue: enabled ? 1 : 0, duration: 250, useNativeDriver: false }),
      Animated.spring(thumbX,        { toValue: enabled ? 1 : 0, friction: 6, tension: 80, useNativeDriver: false }),
      Animated.timing(ghostOpacity,  { toValue: enabled ? 1 : 0.4, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [enabled]);

  const trackBg = trackColor.interpolate({
    inputRange: [0, 1],
    outputRange: [NexusColors.bgCardSolid, 'rgba(99,102,241,0.4)'],
  });
  const thumbLeft = thumbX.interpolate({ inputRange: [0, 1], outputRange: [3, 23] });

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onToggle(!enabled);
  };

  return (
    <View style={s.root}>
      <View style={s.left}>
        <Animated.Text style={[s.ghostEmoji, { opacity: ghostOpacity }]}>👻</Animated.Text>
        <View style={s.textBlock}>
          <Text style={s.title}>Ghost Mode</Text>
          <Text style={s.subtitle}>
            {enabled
              ? 'You appear as "Present" only — no map pin'
              : 'Your location is visible to instructors'}
          </Text>
        </View>
      </View>

      {/* Toggle switch */}
      <TouchableOpacity onPress={handlePress} activeOpacity={0.9}>
        <Animated.View style={[s.track, { backgroundColor: trackBg, borderColor: enabled ? NexusColors.accentIndigo : NexusColors.borderGlass }]}>
          <Animated.View style={[s.thumb, { left: thumbLeft }]} />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: NexusSpacing.md,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.md,
  },
  ghostEmoji: { fontSize: 24 },
  textBlock: { flex: 1 },
  title: {
    fontSize: NexusFonts.sizes.base,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textPrimary,
  },
  subtitle: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
    marginTop: 2,
  },
  track: {
    width: 48,
    height: 28,
    borderRadius: NexusRadius.full,
    borderWidth: 1,
    justifyContent: 'center',
  },
  thumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: NexusColors.textPrimary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
});
