import React, { useEffect, useRef } from 'react'
import { View, Text, Animated, StyleSheet } from 'react-native'
import { NexusColors, NexusFonts, NexusSpacing } from '../../constants/theme'

type GpsState = 'active' | 'searching' | 'disabled'

interface NexusStatusBarProps {
  gpsState: GpsState
  ntpSynced?: boolean
  lowPower?: boolean
}

function GpsPulseDot({ color }: { color: string }) {
  const pulse = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.6, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    )
    anim.start()
    return () => anim.stop()
  }, [pulse])

  return (
    <View style={styles.dotWrapper}>
      <Animated.View
        style={[
          styles.dotRing,
          { borderColor: color, transform: [{ scale: pulse }], opacity: 0.4 },
        ]}
      />
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  )
}

export function NexusStatusBar({ gpsState, ntpSynced = true, lowPower = false }: NexusStatusBarProps) {
  const gpsColor =
    gpsState === 'active'
      ? NexusColors.gpsActive
      : gpsState === 'searching'
      ? NexusColors.gpsSearching
      : NexusColors.gpsDisabled

  const gpsLabel =
    gpsState === 'active' ? 'GPS' : gpsState === 'searching' ? 'GPS…' : 'GPS ✕'

  return (
    <View style={styles.bar}>
      {/* GPS pulse */}
      <View style={styles.indicator}>
        <GpsPulseDot color={gpsColor} />
        <Text style={[styles.label, { color: gpsColor }]}>{gpsLabel}</Text>
      </View>

      {/* NTP sync */}
      <View style={styles.indicator}>
        <Text style={[styles.label, { color: ntpSynced ? NexusColors.accentCyan : NexusColors.textSecondary }]}>
          {ntpSynced ? '⏱ NTP' : '⏱ –'}
        </Text>
      </View>

      {/* Low power */}
      {lowPower && (
        <View style={styles.indicator}>
          <Text style={[styles.label, { color: NexusColors.accentAmber }]}>🍃 ECO</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NexusColors.bgCardSolid,
    paddingHorizontal: NexusSpacing.lg,
    paddingVertical: NexusSpacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: NexusColors.borderGlass,
    gap: NexusSpacing.lg,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.xs,
  },
  dotWrapper: {
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    position: 'absolute',
  },
  dotRing: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    position: 'absolute',
  },
  label: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.medium,
    letterSpacing: NexusFonts.letterSpacing.wide,
  },
})
