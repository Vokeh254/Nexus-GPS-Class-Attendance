import React, { useEffect, useRef } from 'react'
import { View, Text, Animated, StyleSheet } from 'react-native'
import { NexusColors, NexusFonts, NexusSpacing, NexusRadius } from '../../constants/theme'

interface StreakFlameProps {
  streakDays: number
}

export function StreakFlame({ streakDays }: StreakFlameProps) {
  const pulse = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.95, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 300, useNativeDriver: true }),
      ])
    )
    anim.start()
    return () => anim.stop()
  }, [pulse])

  return (
    <View style={styles.container}>
      <Animated.Text style={[styles.flame, { transform: [{ scale: pulse }] }]}>
        🔥
      </Animated.Text>
      <View style={styles.textGroup}>
        <Text style={styles.count}>{streakDays}</Text>
        <Text style={styles.label}>Day Streak</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.sm,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: NexusRadius.md,
    paddingHorizontal: NexusSpacing.md,
    paddingVertical: NexusSpacing.sm,
  },
  flame: {
    fontSize: 28,
  },
  textGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: NexusSpacing.xs,
  },
  count: {
    fontSize: NexusFonts.sizes['2xl'],
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.accentAmber,
  },
  label: {
    fontSize: NexusFonts.sizes.sm,
    fontWeight: NexusFonts.weights.medium,
    color: NexusColors.textSecondary,
  },
})
