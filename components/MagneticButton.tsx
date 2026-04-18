/**
 * MagneticButton — physics-based interactive button
 *
 * Features:
 * - Spring "lean" toward press point on touch
 * - Ripple from exact touch coordinates
 * - Haptic feedback on press
 * - Morph to checkmark on success state
 * - Glow pulse on hover/focus
 */

import React, { useRef, useState } from 'react';
import {
  Animated,
  Easing,
  GestureResponderEvent,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { NexusColors, NexusFonts, NexusSpacing, NexusRadius } from '@/constants/theme';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  success?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
  fullWidth?: boolean;
}

const VARIANT_COLORS: Record<string, { bg: string; text: string; glow: string }> = {
  primary:   { bg: NexusColors.accentCyan,    text: NexusColors.bgPrimary,   glow: NexusColors.accentCyan },
  secondary: { bg: NexusColors.accentIndigo,  text: NexusColors.textPrimary, glow: NexusColors.accentIndigo },
  danger:    { bg: NexusColors.accentRose,    text: NexusColors.textPrimary, glow: NexusColors.accentRose },
  ghost:     { bg: NexusColors.bgCard,        text: NexusColors.accentCyan,  glow: NexusColors.accentCyan },
};

export default function MagneticButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  success = false,
  variant = 'primary',
  icon,
  style,
  fullWidth = false,
}: Props) {
  const colors = VARIANT_COLORS[variant];

  // Spring values
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale      = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  // Ripple
  const rippleScale   = useRef(new Animated.Value(0)).current;
  const rippleOpacity = useRef(new Animated.Value(0)).current;
  const [ripplePos, setRipplePos] = useState({ x: 0, y: 0 });

  // Checkmark draw
  const checkProgress = useRef(new Animated.Value(0)).current;
  const [showCheck, setShowCheck] = useState(false);

  // Spin for loading
  const spinVal = useRef(new Animated.Value(0)).current;
  const spinLoop = useRef<Animated.CompositeAnimation | null>(null);

  React.useEffect(() => {
    if (loading) {
      spinLoop.current = Animated.loop(
        Animated.timing(spinVal, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true })
      );
      spinLoop.current.start();
    } else {
      spinLoop.current?.stop();
      spinVal.setValue(0);
    }
  }, [loading]);

  React.useEffect(() => {
    if (success) {
      setShowCheck(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Animated.spring(checkProgress, { toValue: 1, friction: 4, tension: 60, useNativeDriver: false }).start();
    } else {
      setShowCheck(false);
      checkProgress.setValue(0);
    }
  }, [success]);

  const spinDeg = spinVal.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const handlePressIn = (e: GestureResponderEvent) => {
    if (disabled || loading) return;

    const { locationX, locationY } = e.nativeEvent;
    setRipplePos({ x: locationX, y: locationY });

    // Magnetic lean toward touch point
    const btnW = 200; // approximate
    const btnH = 52;
    const leanX = ((locationX - btnW / 2) / btnW) * 8;
    const leanY = ((locationY - btnH / 2) / btnH) * 4;

    Animated.parallel([
      Animated.spring(translateX, { toValue: leanX, friction: 8, tension: 100, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: leanY, friction: 8, tension: 100, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 0.96, friction: 8, tension: 100, useNativeDriver: true }),
      Animated.timing(glowOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();

    // Ripple
    rippleScale.setValue(0);
    rippleOpacity.setValue(0.4);
    Animated.parallel([
      Animated.timing(rippleScale, { toValue: 4, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(rippleOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(translateX, { toValue: 0, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.timing(glowOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const handlePress = () => {
    if (disabled || loading) return;
    onPress();
  };

  const isGhost = variant === 'ghost';

  return (
    <TouchableWithoutFeedback
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled || loading}
    >
      <Animated.View
        style={[
          s.btn,
          fullWidth && s.fullWidth,
          {
            backgroundColor: colors.bg,
            borderColor: isGhost ? NexusColors.borderGlow : 'transparent',
            borderWidth: isGhost ? 1 : 0,
            opacity: disabled ? 0.45 : 1,
            transform: [{ translateX }, { translateY }, { scale }],
          },
          style,
        ]}
      >
        {/* Glow halo */}
        <Animated.View
          style={[
            s.glowHalo,
            {
              backgroundColor: colors.glow,
              opacity: glowOpacity,
            },
          ]}
        />

        {/* Ripple */}
        <Animated.View
          style={[
            s.ripple,
            {
              left: ripplePos.x - 20,
              top: ripplePos.y - 20,
              backgroundColor: 'rgba(255,255,255,0.3)',
              opacity: rippleOpacity,
              transform: [{ scale: rippleScale }],
            },
          ]}
        />

        {/* Content */}
        <View style={s.content}>
          {loading ? (
            <Animated.View style={{ transform: [{ rotate: spinDeg }] }}>
              <Ionicons name="sync-outline" size={20} color={colors.text} />
            </Animated.View>
          ) : showCheck ? (
            <Ionicons name="checkmark-circle" size={20} color={NexusColors.accentEmerald} />
          ) : (
            <>
              {icon && (
                <Ionicons name={icon} size={18} color={colors.text} style={s.iconLeft} />
              )}
              <Text style={[s.label, { color: colors.text }]}>{label}</Text>
            </>
          )}
        </View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

const s = StyleSheet.create({
  btn: {
    borderRadius: NexusRadius.lg,
    paddingVertical: NexusSpacing.lg,
    paddingHorizontal: NexusSpacing['2xl'],
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  fullWidth: { width: '100%' },
  glowHalo: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: NexusRadius.lg,
    opacity: 0,
  },
  ripple: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.sm,
    zIndex: 1,
  },
  iconLeft: {},
  label: {
    fontSize: NexusFonts.sizes.md,
    fontWeight: NexusFonts.weights.bold,
    letterSpacing: NexusFonts.letterSpacing.wide,
  },
});
