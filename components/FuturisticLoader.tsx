import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, Text } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

export default function FuturisticLoader() {
  const { colors, isDark } = useTheme();
  const rotCW = useRef(new Animated.Value(0)).current;
  const rotCCW = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotCW, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true })
    ).start();
    Animated.loop(
      Animated.timing(rotCCW, { toValue: -1, duration: 1800, easing: Easing.linear, useNativeDriver: true })
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.7, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const spinCW = rotCW.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const spinCCW = rotCCW.interpolate({ inputRange: [-1, 0], outputRange: ['-360deg', '0deg'] });

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Outer ring — clockwise, sky blue */}
      <Animated.View style={[styles.ring, styles.outerRing, { transform: [{ rotate: spinCW }] }]} />
      {/* Inner ring — counter-clockwise, deeper blue */}
      <Animated.View style={[styles.ring, styles.innerRing, { transform: [{ rotate: spinCCW }] }]} />
      {/* Core */}
      <Animated.View style={[styles.core, { opacity: pulse, transform: [{ scale: pulse }] }]} />
      <Text style={[styles.label, { color: colors.subtext }]}>GeoAttend</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 32 },
  ring: { position: 'absolute', borderRadius: 999, borderWidth: 3, borderColor: 'transparent' },
  outerRing: {
    width: 80, height: 80,
    borderTopColor: '#87CEEB',
    borderRightColor: '#87CEEB',
  },
  innerRing: {
    width: 54, height: 54,
    borderTopColor: '#00BFFF',
    borderLeftColor: '#00BFFF',
  },
  core: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#6C63FF',
  },
  label: {
    position: 'absolute',
    bottom: '42%',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 2,
    marginTop: 60,
  },
});
