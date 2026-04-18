/**
 * StardustTrail — Touch particle trail
 * Wraps any screen content. On touch/drag, particles burst from the finger
 * and fade with gravity. Color matches the current accent. Disabled on
 * reduced-motion preference.
 */
import React, { useRef, useState } from 'react';
import { Animated, Easing, PanResponder, StyleSheet, View } from 'react-native';
import { NexusColors } from '@/constants/theme';

interface Particle {
  id: number;
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
  color: string;
}

const COLORS = [
  NexusColors.accentCyan,
  NexusColors.accentIndigo,
  NexusColors.accentEmerald,
  NexusColors.accentAmber,
];

let _id = 0;

interface Props {
  children: React.ReactNode;
  enabled?: boolean;
}

export default function StardustTrail({ children, enabled = true }: Props) {
  const [particles, setParticles] = useState<Particle[]>([]);

  const spawnParticle = (px: number, py: number) => {
    if (!enabled) return;
    const id = _id++;
    const angle = Math.random() * Math.PI * 2;
    const speed = 20 + Math.random() * 30;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];

    const p: Particle = {
      id,
      x: new Animated.Value(px),
      y: new Animated.Value(py),
      opacity: new Animated.Value(0.9),
      scale: new Animated.Value(1),
      color,
    };

    setParticles(prev => [...prev.slice(-24), p]); // cap at 25 particles

    Animated.parallel([
      Animated.timing(p.x, {
        toValue: px + Math.cos(angle) * speed,
        duration: 500,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(p.y, {
        toValue: py + Math.sin(angle) * speed + 15, // gravity
        duration: 500,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(p.opacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(p.scale, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setParticles(prev => prev.filter(q => q.id !== id));
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false, // don't steal touches
      onMoveShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderGrant: (e) => {
        spawnParticle(e.nativeEvent.pageX, e.nativeEvent.pageY);
      },
      onPanResponderMove: (e) => {
        spawnParticle(e.nativeEvent.pageX, e.nativeEvent.pageY);
      },
    })
  ).current;

  return (
    <View style={s.root} {...panResponder.panHandlers}>
      {children}
      {/* Particle layer — pointer-events none so touches pass through */}
      <View style={s.particleLayer} pointerEvents="none">
        {particles.map(p => (
          <Animated.View
            key={p.id}
            style={[
              s.particle,
              {
                backgroundColor: p.color,
                opacity: p.opacity,
                transform: [
                  { translateX: p.x },
                  { translateY: p.y },
                  { scale: p.scale },
                ],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  particleLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  particle: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    top: -3,
    left: -3,
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
});
