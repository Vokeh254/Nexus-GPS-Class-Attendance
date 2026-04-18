import React, { useEffect, useRef } from 'react'
import {
  TouchableOpacity,
  Text,
  View,
  Animated,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { NexusColors, NexusFonts, NexusSpacing, NexusRadius } from '../../constants/theme'

interface AttendanceButtonProps {
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  confirmed?: boolean
}

export function AttendanceButton({
  onPress,
  disabled = false,
  loading = false,
  confirmed = false,
}: AttendanceButtonProps) {
  const prevConfirmed = useRef(false)
  const scale = useRef(new Animated.Value(1)).current

  // Trigger haptic + scale animation when transitioning to confirmed
  useEffect(() => {
    if (confirmed && !prevConfirmed.current) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.08, duration: 150, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
      ]).start()
    }
    prevConfirmed.current = confirmed
  }, [confirmed, scale])

  const getBackgroundColor = () => {
    if (confirmed) return NexusColors.accentEmerald
    if (disabled) return NexusColors.textDisabled
    return NexusColors.accentCyan
  }

  const isInteractable = !disabled && !loading && !confirmed

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={isInteractable ? onPress : undefined}
        activeOpacity={isInteractable ? 0.8 : 1}
        style={[styles.button, { backgroundColor: getBackgroundColor() }]}
        accessibilityRole="button"
        accessibilityState={{ disabled: !isInteractable }}
      >
        {loading ? (
          <ActivityIndicator color={NexusColors.textPrimary} size="small" />
        ) : confirmed ? (
          <View style={styles.row}>
            <Text style={styles.checkmark}>✓</Text>
            <Text style={styles.label}>Attendance Marked</Text>
          </View>
        ) : (
          <Text style={[styles.label, disabled && styles.labelDisabled]}>
            Mark Attendance
          </Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  button: {
    borderRadius: NexusRadius.lg,
    paddingVertical: NexusSpacing.lg,
    paddingHorizontal: NexusSpacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.sm,
  },
  checkmark: {
    fontSize: NexusFonts.sizes.lg,
    color: NexusColors.textPrimary,
    fontWeight: NexusFonts.weights.bold,
  },
  label: {
    fontSize: NexusFonts.sizes.md,
    fontWeight: NexusFonts.weights.semibold,
    color: NexusColors.textPrimary,
    letterSpacing: NexusFonts.letterSpacing.wide,
  },
  labelDisabled: {
    color: NexusColors.textSecondary,
  },
})
