/**
 * ARClassroomFinder — Holo-Desk AR placeholder
 * Renders a camera-style viewfinder with floating directional arrows,
 * distance indicator, and a "portal" preview card when near the destination.
 * Real AR (ARKit/ARCore) can be wired in by replacing the placeholder canvas.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { NexusColors, NexusFonts, NexusSpacing, NexusRadius } from '@/constants/theme';

const { width: W, height: H } = Dimensions.get('window');

interface Overlay {
  type: 'arrow' | 'portal';
  distance: string;
  direction?: 'left' | 'right' | 'forward';
  preview?: string;
}

interface Props {
  destination: string;
  distanceMetres?: number;
  overlays?: Overlay[];
  visible: boolean;
  onClose: () => void;
}

const ARROW_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  left:    'arrow-back-circle',
  right:   'arrow-forward-circle',
  forward: 'arrow-up-circle',
};

export default function ARClassroomFinder({
  destination,
  distanceMetres = 45,
  overlays = [
    { type: 'arrow', distance: '45m', direction: 'left' },
    { type: 'portal', distance: '5m', preview: 'Lecture Hall 302' },
  ],
  visible,
  onClose,
}: Props) {
  // Scanning line animation
  const scanY    = useRef(new Animated.Value(0)).current;
  const arrowPulse = useRef(new Animated.Value(0.7)).current;
  const portalScale = useRef(new Animated.Value(0)).current;
  const [showPortal, setShowPortal] = useState(distanceMetres <= 10);

  useEffect(() => {
    if (!visible) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    // Scanning line sweeps top → bottom
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanY, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(scanY, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    ).start();

    // Arrow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(arrowPulse, { toValue: 1,   duration: 700, useNativeDriver: true }),
        Animated.timing(arrowPulse, { toValue: 0.7, duration: 700, useNativeDriver: true }),
      ])
    ).start();

    // Portal reveal when close
    if (distanceMetres <= 10) {
      setShowPortal(true);
      Animated.spring(portalScale, { toValue: 1, friction: 5, tension: 50, useNativeDriver: true }).start();
    }
  }, [visible, distanceMetres]);

  const scanTranslateY = scanY.interpolate({ inputRange: [0, 1], outputRange: [0, H * 0.7] });

  const arrowOverlay = overlays.find(o => o.type === 'arrow');
  const arrowDir = (arrowOverlay?.direction ?? 'forward') as 'left' | 'right' | 'forward';

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <View style={s.root}>
        {/* Simulated camera feed — dark with grid */}
        <View style={s.cameraFeed}>
          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map(f => (
            <View key={`h${f}`} style={[s.gridLineH, { top: `${f * 100}%` as any }]} />
          ))}
          {[0.33, 0.66].map(f => (
            <View key={`v${f}`} style={[s.gridLineV, { left: `${f * 100}%` as any }]} />
          ))}

          {/* Scanning line */}
          <Animated.View style={[s.scanLine, { transform: [{ translateY: scanTranslateY }] }]} />

          {/* Corner brackets */}
          <View style={[s.corner, s.cornerTL]} />
          <View style={[s.corner, s.cornerTR]} />
          <View style={[s.corner, s.cornerBL]} />
          <View style={[s.corner, s.cornerBR]} />

          {/* Directional arrow */}
          <Animated.View style={[s.arrowWrap, { opacity: arrowPulse }]}>
            <Ionicons name={ARROW_ICONS[arrowDir]} size={72} color={NexusColors.accentCyan} />
            <Text style={s.arrowDist}>{arrowOverlay?.distance ?? `${distanceMetres}m`}</Text>
          </Animated.View>

          {/* Portal preview (when close) */}
          {showPortal && (
            <Animated.View style={[s.portalCard, { transform: [{ scale: portalScale }] }]}>
              <View style={s.portalHeader}>
                <Text style={s.portalEmoji}>🚪</Text>
                <Text style={s.portalTitle}>PORTAL PREVIEW</Text>
              </View>
              <Text style={s.portalRoom}>{destination}</Text>
              <Text style={s.portalSub}>You're almost there — 5m away</Text>
              <View style={s.portalBadge}>
                <View style={s.portalDot} />
                <Text style={s.portalBadgeText}>ENTER NOW</Text>
              </View>
            </Animated.View>
          )}

          {/* AR label */}
          <View style={s.arLabel}>
            <Text style={s.arLabelText}>AR MODE</Text>
            <Text style={s.arLabelSub}>ARKit/ARCore ready</Text>
          </View>
        </View>

        {/* HUD overlay */}
        <View style={s.hud}>
          <View style={s.hudLeft}>
            <Text style={s.hudLabel}>DESTINATION</Text>
            <Text style={s.hudValue}>{destination}</Text>
          </View>
          <View style={s.hudRight}>
            <Text style={s.hudLabel}>DISTANCE</Text>
            <Text style={[s.hudValue, { color: distanceMetres <= 10 ? NexusColors.accentEmerald : NexusColors.accentCyan }]}>
              {distanceMetres}m
            </Text>
          </View>
        </View>

        {/* Close */}
        <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.8}>
          <Ionicons name="close-circle" size={36} color={NexusColors.textPrimary} />
        </TouchableOpacity>

        {/* Accessibility hint */}
        <Text style={s.a11yHint}>
          Audio directions available · Haptic guidance active
        </Text>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraFeed: {
    flex: 1,
    backgroundColor: '#050A14',
    position: 'relative',
    overflow: 'hidden',
  },
  gridLineH: {
    position: 'absolute',
    left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(6,182,212,0.08)',
  },
  gridLineV: {
    position: 'absolute',
    top: 0, bottom: 0,
    width: 1,
    backgroundColor: 'rgba(6,182,212,0.08)',
  },
  scanLine: {
    position: 'absolute',
    left: 0, right: 0,
    height: 2,
    backgroundColor: NexusColors.accentCyan,
    opacity: 0.5,
    shadowColor: NexusColors.accentCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 4,
  },
  // Corner brackets
  corner: {
    position: 'absolute',
    width: 24, height: 24,
    borderColor: NexusColors.accentCyan,
  },
  cornerTL: { top: 40, left: 20, borderTopWidth: 2, borderLeftWidth: 2 },
  cornerTR: { top: 40, right: 20, borderTopWidth: 2, borderRightWidth: 2 },
  cornerBL: { bottom: 120, left: 20, borderBottomWidth: 2, borderLeftWidth: 2 },
  cornerBR: { bottom: 120, right: 20, borderBottomWidth: 2, borderRightWidth: 2 },
  // Arrow
  arrowWrap: {
    position: 'absolute',
    top: '35%',
    alignSelf: 'center',
    alignItems: 'center',
    gap: NexusSpacing.sm,
  },
  arrowDist: {
    fontSize: NexusFonts.sizes.xl,
    fontWeight: NexusFonts.weights.black,
    color: NexusColors.accentCyan,
    letterSpacing: NexusFonts.letterSpacing.wider,
    textShadowColor: NexusColors.accentCyan,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  // Portal
  portalCard: {
    position: 'absolute',
    bottom: 130,
    left: NexusSpacing['2xl'],
    right: NexusSpacing['2xl'],
    backgroundColor: NexusColors.bgCard,
    borderRadius: NexusRadius.xl,
    borderWidth: 1,
    borderColor: NexusColors.borderGlow,
    padding: NexusSpacing.lg,
    gap: NexusSpacing.sm,
  },
  portalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.sm,
  },
  portalEmoji: { fontSize: 18 },
  portalTitle: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.black,
    color: NexusColors.textSecondary,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
  portalRoom: {
    fontSize: NexusFonts.sizes.xl,
    fontWeight: NexusFonts.weights.black,
    color: NexusColors.textPrimary,
  },
  portalSub: {
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.textSecondary,
  },
  portalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderRadius: NexusRadius.full,
    paddingHorizontal: NexusSpacing.md,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: NexusColors.accentEmerald,
  },
  portalDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: NexusColors.accentEmerald,
  },
  portalBadgeText: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.black,
    color: NexusColors.accentEmerald,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
  // AR label
  arLabel: {
    position: 'absolute',
    top: 48,
    alignSelf: 'center',
    alignItems: 'center',
  },
  arLabelText: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.black,
    color: NexusColors.accentCyan,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
  arLabelSub: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textDisabled,
    letterSpacing: NexusFonts.letterSpacing.wide,
  },
  // HUD
  hud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: NexusColors.bgCardSolid,
    borderTopWidth: 1,
    borderTopColor: NexusColors.borderGlass,
    paddingHorizontal: NexusSpacing['2xl'],
    paddingVertical: NexusSpacing.lg,
  },
  hudLeft: {},
  hudRight: { alignItems: 'flex-end' },
  hudLabel: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textDisabled,
    letterSpacing: NexusFonts.letterSpacing.widest,
    marginBottom: 2,
  },
  hudValue: {
    fontSize: NexusFonts.sizes.lg,
    fontWeight: NexusFonts.weights.black,
    color: NexusColors.accentCyan,
  },
  closeBtn: {
    position: 'absolute',
    top: 48,
    right: NexusSpacing.xl,
  },
  a11yHint: {
    position: 'absolute',
    bottom: 90,
    alignSelf: 'center',
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textDisabled,
    letterSpacing: NexusFonts.letterSpacing.wide,
  },
});
