import React, { useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native'
import { NexusColors, NexusFonts, NexusSpacing, NexusRadius } from '../../constants/theme'

interface ProxyAlertProps {
  studentName: string
  reason: string
  onInvestigate: () => void
  onDismiss: () => void
}

export function ProxyAlert({ studentName, reason, onInvestigate, onDismiss }: ProxyAlertProps) {
  const shakeX = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.sequence([
      Animated.timing(shakeX, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -4, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 4, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start()
  }, [shakeX])

  return (
    <Animated.View style={[styles.card, { transform: [{ translateX: shakeX }] }]}>
      <View style={styles.header}>
        <Text style={styles.icon}>⚠️</Text>
        <View style={styles.headerText}>
          <Text style={styles.title}>PROXY ATTEMPT DETECTED</Text>
          <Text style={styles.studentName}>{studentName}</Text>
        </View>
      </View>
      <Text style={styles.reason}>{reason}</Text>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.investigateBtn} onPress={onInvestigate} activeOpacity={0.8}>
          <Text style={styles.investigateLabel}>Investigate</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss} activeOpacity={0.8}>
          <Text style={styles.dismissLabel}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderRadius: NexusRadius.lg,
    padding: NexusSpacing.lg,
    shadowColor: NexusColors.accentAmber,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
    gap: NexusSpacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.sm,
  },
  icon: {
    fontSize: 22,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.accentAmber,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
  studentName: {
    fontSize: NexusFonts.sizes.md,
    fontWeight: NexusFonts.weights.semibold,
    color: NexusColors.textPrimary,
  },
  reason: {
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.textSecondary,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: NexusSpacing.sm,
    marginTop: NexusSpacing.xs,
  },
  investigateBtn: {
    flex: 1,
    backgroundColor: NexusColors.accentAmber,
    borderRadius: NexusRadius.md,
    paddingVertical: NexusSpacing.sm,
    alignItems: 'center',
  },
  investigateLabel: {
    fontSize: NexusFonts.sizes.sm,
    fontWeight: NexusFonts.weights.semibold,
    color: '#0B1120',
  },
  dismissBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderRadius: NexusRadius.md,
    paddingVertical: NexusSpacing.sm,
    alignItems: 'center',
  },
  dismissLabel: {
    fontSize: NexusFonts.sizes.sm,
    fontWeight: NexusFonts.weights.medium,
    color: NexusColors.accentAmber,
  },
})
