/**
 * OrbitalPreloader — 4-phase cinematic boot sequence
 *
 * Phase 1 (0–2.5s)  Boot       — wireframe bloom + typewriter
 * Phase 2 (2.5–4s)  GPS Lock   — radar pulses + uplink text
 * Phase 3 (4–5s)    Biometric  — fingerprint morph + secure text
 * Phase 4 (5–5.8s)  Ready      — logo reveal + particle burst
 *
 * Tap anywhere to skip.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
  Dimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { NexusColors, NexusFonts, NexusSpacing } from '@/constants/theme';

const { width: W, height: H } = Dimensions.get('window');
const CX = W / 2;
const CY = H / 2;

// ─── Timing ──────────────────────────────────────────────────────────────────
const PHASE_DURATIONS = [2500, 1500, 1000, 800] as const;
const PHASE_LABELS = [
  'INITIALIZING NEXUS...',
  'ESTABLISHING SECURE UPLINK...',
  'BIOMETRIC CHANNEL SECURE',
  'WELCOME TO NEXUS',
] as const;

// ─── Particle ─────────────────────────────────────────────────────────────────
interface Particle {
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
  color: string;
}

function makeParticles(count: number): Particle[] {
  const colors = [
    NexusColors.accentCyan,
    NexusColors.accentIndigo,
    NexusColors.accentEmerald,
    NexusColors.accentAmber,
  ];
  return Array.from({ length: count }, (_, i) => ({
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    opacity: new Animated.Value(0),
    scale: new Animated.Value(0),
    color: colors[i % colors.length],
  }));
}

// ─── Typewriter hook ──────────────────────────────────────────────────────────
function useTypewriter(text: string, active: boolean, speed = 40) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    if (!active) { setDisplayed(''); return; }
    setDisplayed('');
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, active]);
  return displayed;
}

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
  onComplete: () => void;
}

export default function OrbitalPreloader({ onComplete }: Props) {
  const [phase, setPhase] = useState(0);
  const [skipped, setSkipped] = useState(false);

  // Shared animated values
  const masterOpacity = useRef(new Animated.Value(1)).current;
  const logoScale    = useRef(new Animated.Value(0)).current;
  const logoOpacity  = useRef(new Animated.Value(0)).current;

  // Phase 1 — wireframe
  const wireOpacity  = useRef(new Animated.Value(0)).current;
  const wireScale    = useRef(new Animated.Value(0.3)).current;
  const wireRotate   = useRef(new Animated.Value(0)).current;

  // Phase 2 — radar
  const radar1       = useRef(new Animated.Value(0)).current;
  const radar2       = useRef(new Animated.Value(0)).current;
  const radar3       = useRef(new Animated.Value(0)).current;
  const radarOpacity = useRef(new Animated.Value(0)).current;
  const progressArc  = useRef(new Animated.Value(0)).current;
  const orbitRot     = useRef(new Animated.Value(0)).current;

  // Phase 3 — biometric
  const bioOpacity   = useRef(new Animated.Value(0)).current;
  const bioScale     = useRef(new Animated.Value(0.5)).current;
  const bioGlow      = useRef(new Animated.Value(0)).current;
  const lockScale    = useRef(new Animated.Value(0)).current;
  const lockOpacity  = useRef(new Animated.Value(0)).current;

  // Phase 4 — particles
  const particles    = useRef(makeParticles(16)).current;
  const particleOpacity = useRef(new Animated.Value(0)).current;

  // Continuous orbit ring
  const ringRot = useRef(new Animated.Value(0)).current;
  const ringRot2 = useRef(new Animated.Value(0)).current;

  const typeText = useTypewriter(PHASE_LABELS[phase] ?? '', true, 35);

  // ── Skip handler ────────────────────────────────────────────────────────────
  const skip = useCallback(() => {
    if (skipped) return;
    setSkipped(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.timing(masterOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => onComplete());
  }, [skipped, masterOpacity, onComplete]);

  // ── Continuous ring spin ────────────────────────────────────────────────────
  useEffect(() => {
    Animated.loop(
      Animated.timing(ringRot, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true })
    ).start();
    Animated.loop(
      Animated.timing(ringRot2, { toValue: -1, duration: 4500, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, []);

  // ── Phase sequencer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (skipped) return;

    // Phase 1 — Boot / wireframe bloom
    Animated.parallel([
      Animated.timing(wireOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(wireScale, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
      Animated.loop(
        Animated.timing(wireRotate, { toValue: 1, duration: 8000, easing: Easing.linear, useNativeDriver: true })
      ),
    ]).start();

    const t1 = setTimeout(() => {
      if (skipped) return;
      setPhase(1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      // Phase 2 — Radar pulses
      Animated.timing(radarOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      Animated.timing(progressArc, { toValue: 1, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();

      const pulse = (val: Animated.Value, delay: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(val, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(val, { toValue: 0, duration: 100, useNativeDriver: true }),
          ])
        ).start();

      pulse(radar1, 0);
      pulse(radar2, 300);
      pulse(radar3, 600);

      Animated.loop(
        Animated.timing(orbitRot, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true })
      ).start();
    }, PHASE_DURATIONS[0]);

    const t2 = setTimeout(() => {
      if (skipped) return;
      setPhase(2);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      // Phase 3 — Biometric
      Animated.parallel([
        Animated.timing(bioOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(bioScale, { toValue: 1, friction: 5, tension: 50, useNativeDriver: true }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(bioGlow, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.timing(bioGlow, { toValue: 0.3, duration: 600, useNativeDriver: true }),
          ])
        ),
      ]).start();

      setTimeout(() => {
        Animated.parallel([
          Animated.spring(lockScale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }),
          Animated.timing(lockOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]).start();
      }, 500);
    }, PHASE_DURATIONS[0] + PHASE_DURATIONS[1]);

    const t3 = setTimeout(() => {
      if (skipped) return;
      setPhase(3);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      // Phase 4 — Logo reveal + particles
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 4, tension: 50, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(particleOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();

      // Burst particles
      particles.forEach((p, i) => {
        const angle = (i / particles.length) * Math.PI * 2;
        const dist = 80 + Math.random() * 60;
        Animated.parallel([
          Animated.timing(p.opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
          Animated.timing(p.scale, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(p.x, { toValue: Math.cos(angle) * dist, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(p.y, { toValue: Math.sin(angle) * dist, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]).start(() => {
          Animated.parallel([
            Animated.timing(p.opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
            Animated.timing(p.scale, { toValue: 0, duration: 400, useNativeDriver: true }),
          ]).start();
        });
      });
    }, PHASE_DURATIONS[0] + PHASE_DURATIONS[1] + PHASE_DURATIONS[2]);

    const t4 = setTimeout(() => {
      if (skipped) return;
      Animated.timing(masterOpacity, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => onComplete());
    }, PHASE_DURATIONS[0] + PHASE_DURATIONS[1] + PHASE_DURATIONS[2] + PHASE_DURATIONS[3]);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [skipped]);

  // ── Interpolations ──────────────────────────────────────────────────────────
  const wireRotDeg = wireRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const ringRotDeg = ringRot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const ringRotDeg2 = ringRot2.interpolate({ inputRange: [-1, 0], outputRange: ['-360deg', '0deg'] });
  const orbitDeg = orbitRot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const r1Scale = radar1.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1.4] });
  const r1Opacity = radar1.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.8, 0.4, 0] });
  const r2Scale = radar2.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1.4] });
  const r2Opacity = radar2.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.8, 0.4, 0] });
  const r3Scale = radar3.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1.4] });
  const r3Opacity = radar3.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.8, 0.4, 0] });

  const bioGlowColor = bioGlow.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(6,182,212,0.2)', 'rgba(6,182,212,0.7)'],
  });

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <TouchableWithoutFeedback onPress={skip}>
      <Animated.View style={[s.root, { opacity: masterOpacity }]}>

        {/* ── Continuous orbit rings (always visible) ── */}
        <Animated.View style={[s.orbitRing, s.orbitRingOuter, { transform: [{ rotate: ringRotDeg }] }]} />
        <Animated.View style={[s.orbitRing, s.orbitRingInner, { transform: [{ rotate: ringRotDeg2 }] }]} />

        {/* ── Phase 1: Wireframe hexagon ── */}
        {phase === 0 && (
          <Animated.View style={[s.center, { opacity: wireOpacity, transform: [{ scale: wireScale }, { rotate: wireRotDeg }] }]}>
            <View style={s.hexWire}>
              {[0, 60, 120, 180, 240, 300].map((deg) => (
                <View
                  key={deg}
                  style={[
                    s.hexLine,
                    { transform: [{ rotate: `${deg}deg` }] },
                  ]}
                />
              ))}
              <View style={s.hexCenter} />
            </View>
          </Animated.View>
        )}

        {/* ── Phase 2: Radar pulses ── */}
        {phase === 1 && (
          <Animated.View style={[s.center, { opacity: radarOpacity }]}>
            {/* Pulse rings */}
            <Animated.View style={[s.radarRing, { transform: [{ scale: r1Scale }], opacity: r1Opacity }]} />
            <Animated.View style={[s.radarRing, { transform: [{ scale: r2Scale }], opacity: r2Opacity }]} />
            <Animated.View style={[s.radarRing, { transform: [{ scale: r3Scale }], opacity: r3Opacity }]} />
            {/* Orbiting satellite dot */}
            <Animated.View style={[s.orbitTrack, { transform: [{ rotate: orbitDeg }] }]}>
              <View style={s.satelliteDot} />
            </Animated.View>
            {/* GPS icon */}
            <View style={s.gpsIcon}>
              <Text style={s.gpsGlyph}>📡</Text>
            </View>
            {/* Progress arc (simulated with border) */}
            <Animated.View style={[s.progressRing, { opacity: progressArc }]} />
          </Animated.View>
        )}

        {/* ── Phase 3: Biometric ── */}
        {phase === 2 && (
          <Animated.View style={[s.center, { opacity: bioOpacity, transform: [{ scale: bioScale }] }]}>
            <Animated.View style={[s.bioGlowRing, { shadowColor: NexusColors.accentCyan, opacity: bioGlow }]} />
            <Text style={s.bioGlyph}>🫆</Text>
            {/* Neural lines */}
            {[0, 45, 90, 135].map((deg) => (
              <Animated.View
                key={deg}
                style={[s.neuralLine, { transform: [{ rotate: `${deg}deg` }], opacity: bioGlow }]}
              />
            ))}
            {/* Lock materializes */}
            <Animated.View style={[s.lockWrap, { opacity: lockOpacity, transform: [{ scale: lockScale }] }]}>
              <Text style={s.lockGlyph}>🔓</Text>
            </Animated.View>
          </Animated.View>
        )}

        {/* ── Phase 4: Logo reveal ── */}
        {phase === 3 && (
          <>
            {/* Particle burst */}
            <Animated.View style={[s.center, { opacity: particleOpacity }]}>
              {particles.map((p, i) => (
                <Animated.View
                  key={i}
                  style={[
                    s.particle,
                    {
                      backgroundColor: p.color,
                      opacity: p.opacity,
                      transform: [{ translateX: p.x }, { translateY: p.y }, { scale: p.scale }],
                    },
                  ]}
                />
              ))}
            </Animated.View>
            {/* Logo */}
            <Animated.View style={[s.logoWrap, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
              <View style={s.logoHex}>
                <Text style={s.logoHexGlyph}>⬡</Text>
              </View>
              <Text style={s.logoWordmark}>NEXUS</Text>
              <Text style={s.logoSub}>Attendance System</Text>
            </Animated.View>
          </>
        )}

        {/* ── Status text (typewriter) ── */}
        <View style={s.statusWrap}>
          <Text style={s.statusText}>{typeText}</Text>
          <View style={s.statusDots}>
            {[0, 1, 2].map((i) => (
              <PulsingDot key={i} delay={i * 200} />
            ))}
          </View>
        </View>

        {/* ── Phase progress bar ── */}
        <View style={s.phaseBarWrap}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                s.phaseSegment,
                i <= phase ? s.phaseSegmentActive : s.phaseSegmentInactive,
                i < 3 && { marginRight: 6 },
              ]}
            />
          ))}
        </View>

        {/* ── Skip hint ── */}
        <Text style={s.skipHint}>TAP TO SKIP</Text>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

// ─── Pulsing dot ──────────────────────────────────────────────────────────────
function PulsingDot({ delay }: { delay: number }) {
  const opacity = useRef(new Animated.Value(0.2)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.2, duration: 400, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[s.dot, { opacity }]} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: NexusColors.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Orbit rings
  orbitRing: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
  },
  orbitRingOuter: {
    width: 220,
    height: 220,
    borderColor: 'rgba(6,182,212,0.15)',
    borderStyle: 'dashed',
  },
  orbitRingInner: {
    width: 150,
    height: 150,
    borderColor: 'rgba(99,102,241,0.2)',
  },

  // Phase 1 — wireframe hex
  hexWire: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hexLine: {
    position: 'absolute',
    width: 100,
    height: 1,
    backgroundColor: NexusColors.accentCyan,
    opacity: 0.6,
  },
  hexCenter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: NexusColors.accentCyan,
    shadowColor: NexusColors.accentCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },

  // Phase 2 — radar
  radarRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1.5,
    borderColor: NexusColors.accentCyan,
  },
  orbitTrack: {
    position: 'absolute',
    width: 120,
    height: 120,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  satelliteDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: NexusColors.accentAmber,
    shadowColor: NexusColors.accentAmber,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 4,
  },
  gpsIcon: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsGlyph: { fontSize: 36 },
  progressRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 2,
    borderColor: NexusColors.accentCyan,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
  },

  // Phase 3 — biometric
  bioGlowRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: NexusColors.accentCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 8,
  },
  bioGlyph: { fontSize: 56 },
  neuralLine: {
    position: 'absolute',
    width: 140,
    height: 1,
    backgroundColor: NexusColors.accentCyan,
    opacity: 0.3,
  },
  lockWrap: {
    position: 'absolute',
    bottom: -40,
    alignItems: 'center',
  },
  lockGlyph: { fontSize: 28 },

  // Phase 4 — logo
  logoWrap: {
    position: 'absolute',
    alignItems: 'center',
    gap: 8,
  },
  logoHex: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: NexusColors.bgCardSolid,
    borderWidth: 1.5,
    borderColor: NexusColors.borderGlow,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: NexusColors.accentCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
  },
  logoHexGlyph: { fontSize: 36, color: NexusColors.accentCyan },
  logoWordmark: {
    fontSize: NexusFonts.sizes['3xl'],
    fontWeight: NexusFonts.weights.black,
    color: NexusColors.textPrimary,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
  logoSub: {
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.textSecondary,
    letterSpacing: NexusFonts.letterSpacing.wider,
  },

  // Particles
  particle: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Status text
  statusWrap: {
    position: 'absolute',
    bottom: H * 0.22,
    alignItems: 'center',
    gap: NexusSpacing.sm,
  },
  statusText: {
    fontSize: NexusFonts.sizes.sm,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.accentCyan,
    letterSpacing: NexusFonts.letterSpacing.widest,
    minHeight: 18,
  },
  statusDots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: NexusColors.accentCyan,
  },

  // Phase progress bar
  phaseBarWrap: {
    position: 'absolute',
    bottom: H * 0.14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  phaseSegment: {
    height: 3,
    width: 40,
    borderRadius: 2,
  },
  phaseSegmentActive: {
    backgroundColor: NexusColors.accentCyan,
    shadowColor: NexusColors.accentCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  phaseSegmentInactive: {
    backgroundColor: 'rgba(148,163,184,0.15)',
  },

  // Skip
  skipHint: {
    position: 'absolute',
    bottom: H * 0.08,
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textDisabled,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
});
