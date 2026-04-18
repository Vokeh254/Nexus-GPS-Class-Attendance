import React, { useEffect, useRef } from 'react'
import { View, Text, Animated, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { NexusColors, NexusFonts, NexusSpacing, NexusRadius } from '../../constants/theme'
import type { AttendanceLog } from '../../types'

interface HolographicAttendanceCardProps {
  log: AttendanceLog
}

function formatTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return isoString
  }
}

function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return isoString
  }
}

export function HolographicAttendanceCard({ log }: HolographicAttendanceCardProps) {
  const shimmer = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    )
    anim.start()
    return () => anim.stop()
  }, [shimmer])

  const shimmerOpacity = shimmer.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.25, 0] })
  const shimmerTranslate = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-200, 200] })

  const statusColor = log.verified ? NexusColors.accentEmerald : NexusColors.accentAmber
  const statusLabel = log.verified ? '✓ VERIFIED' : '⏳ PENDING'

  return (
    <View style={styles.card}>
      {/* Holographic gradient base */}
      <LinearGradient
        colors={['rgba(6,182,212,0.15)', 'rgba(99,102,241,0.1)', 'rgba(16,185,129,0.12)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Shimmer sweep */}
      <Animated.View
        style={[
          styles.shimmer,
          {
            opacity: shimmerOpacity,
            transform: [{ translateX: shimmerTranslate }],
          },
        ]}
      />

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.classInfo}>
            <Text style={styles.classId} numberOfLines={1}>
              {log.class_id}
            </Text>
            <Text style={styles.sessionId} numberOfLines={1}>
              Session {log.session_id.slice(0, 8)}…
            </Text>
          </View>
          <View style={[styles.statusBadge, { borderColor: statusColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.detailsRow}>
          <View style={styles.detail}>
            <Text style={styles.detailLabel}>TIME</Text>
            <Text style={styles.detailValue}>{formatTime(log.signed_at)}</Text>
          </View>
          <View style={styles.detail}>
            <Text style={styles.detailLabel}>DATE</Text>
            <Text style={styles.detailValue}>{formatDate(log.signed_at)}</Text>
          </View>
          <View style={styles.detail}>
            <Text style={styles.detailLabel}>ACCURACY</Text>
            <Text style={styles.detailValue}>{log.accuracy_m.toFixed(0)}m</Text>
          </View>
        </View>

        <View style={styles.coordsRow}>
          <Text style={styles.coordsText}>
            📍 {log.latitude.toFixed(5)}, {log.longitude.toFixed(5)}
          </Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: NexusRadius.lg,
    borderWidth: 1,
    borderColor: NexusColors.borderGlow,
    overflow: 'hidden',
    backgroundColor: NexusColors.bgCard,
    shadowColor: NexusColors.accentCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    transform: [{ skewX: '-20deg' }],
  },
  content: {
    padding: NexusSpacing.lg,
    gap: NexusSpacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  classInfo: {
    flex: 1,
    marginRight: NexusSpacing.sm,
  },
  classId: {
    fontSize: NexusFonts.sizes.md,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textPrimary,
  },
  sessionId: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: NexusRadius.sm,
    paddingHorizontal: NexusSpacing.sm,
    paddingVertical: NexusSpacing.xs,
  },
  statusText: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.bold,
    letterSpacing: NexusFonts.letterSpacing.wide,
  },
  divider: {
    height: 1,
    backgroundColor: NexusColors.borderGlass,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detail: {
    alignItems: 'center',
    gap: 2,
  },
  detailLabel: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
  detailValue: {
    fontSize: NexusFonts.sizes.sm,
    fontWeight: NexusFonts.weights.semibold,
    color: NexusColors.textPrimary,
  },
  coordsRow: {
    marginTop: NexusSpacing.xs,
  },
  coordsText: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
    fontFamily: 'monospace',
  },
})
