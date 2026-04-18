import React from 'react'
import { View, ViewStyle, StyleSheet } from 'react-native'
import { NexusColors, NexusRadius } from '../../constants/theme'

// expo-blur is not in package.json, so we use a semi-transparent View fallback

interface GlassmorphicCardProps {
  children: React.ReactNode
  style?: ViewStyle
  glowColor?: string
}

export function GlassmorphicCard({ children, style, glowColor }: GlassmorphicCardProps) {
  const glowStyle: ViewStyle | null = glowColor
    ? {
        shadowColor: glowColor,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 12,
        elevation: 8,
      }
    : null

  return (
    <View style={[styles.card, glowStyle, style]}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: NexusColors.bgCard,
    borderWidth: 1,
    borderColor: NexusColors.borderGlass,
    borderRadius: NexusRadius.lg,
    overflow: 'hidden',
  },
})
