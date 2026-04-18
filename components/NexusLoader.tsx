/**
 * NexusLoader — lightweight in-screen loading state
 * Replaces FuturisticLoader everywhere inside screens/tabs.
 * Matches the Nexus deep-space design language.
 */
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { NexusColors, NexusFonts, NexusSpacing } from '@/constants/theme';

interface Props {
  label?: string;
}

export default function NexusLoader({ label = 'LOADING...' }: Props) {
  const rotOuter  = useRef(new Animated.Value(0)).current;
  const rotInner  = useRef(new Animated.Value(0)).current;
  const pulse     = useRef(new Animated.Value(0.6)).current;
  const glowOpacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotOuter, { toValue: 1, duration: 1800, easing: Easing.linear, useNativeDriver: true })
    ).start();
    Animated.loop(
      Animated.timing(rotInner, { toValue: -1, duration: 1100, easing: Easing.linear, useNativeDriver: true })
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.6, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.3, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const spinOuter = rotOuter.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const spinInner = rotInner.interpolate({ inputRange: [-1, 0], outputRange: ['-360deg', '0deg'] });

  return (
    <View style={s.root}>
      {/* Outer ring */}
      <Animated.View style={[s.ring, s.outerRing, { transform: [{ rotate: spinOuter }] }]} />
      {/* Inner ring */}
      <Animated.View style={[s.ring, s.innerRing, { transform: [{ rotate: spinInner }] }]} />
      {/* Glow halo */}
      <Animated.View style={[s.glow, { opacity: glowOpacity }]} />
      {/* Core dot */}
      <Animated.View style={[s.core, { opacity: pulse, transform: [{ scale: pulse }] }]} />
      {/* Label */}
      <Text style={s.label}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: NexusColors.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: NexusSpacing['3xl'],
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  outerRing: {
    width: 72,
    height: 72,
    borderTopColor: NexusColors.accentCyan,
    borderRightColor: NexusColors.accentCyan,
  },
  innerRing: {
    width: 46,
    height: 46,
    borderTopColor: NexusColors.accentIndigo,
    borderLeftColor: NexusColors.accentIndigo,
  },
  glow: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: NexusColors.accentCyan,
    shadowColor: NexusColors.accentCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 6,
    opacity: 0.08,
  },
  core: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: NexusColors.accentCyan,
    shadowColor: NexusColors.accentCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  label: {
    position: 'absolute',
    bottom: '42%',
    marginTop: 56,
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textSecondary,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
});
