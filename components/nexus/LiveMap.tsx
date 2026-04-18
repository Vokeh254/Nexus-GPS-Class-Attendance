import React from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { NexusColors, NexusFonts, NexusSpacing, NexusRadius } from '../../constants/theme'

interface Student {
  id: string
  name: string
  checkedIn: boolean
  coords?: { lat: number; lng: number }
}

interface LiveMapProps {
  students: Student[]
}

export function LiveMap({ students }: LiveMapProps) {
  const checkedIn = students.filter((s) => s.checkedIn)
  const absent = students.filter((s) => !s.checkedIn)

  return (
    <View style={styles.container}>
      {/* Summary row */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <View style={[styles.legendDot, { backgroundColor: NexusColors.accentCyan }]} />
          <Text style={styles.summaryText}>{checkedIn.length} In</Text>
        </View>
        <View style={styles.summaryItem}>
          <View style={[styles.legendDot, { backgroundColor: NexusColors.accentRose }]} />
          <Text style={styles.summaryText}>{absent.length} Absent</Text>
        </View>
      </View>

      {/* Dot grid */}
      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {students.map((student) => (
          <View key={student.id} style={styles.studentItem}>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: student.checkedIn
                    ? NexusColors.accentCyan
                    : NexusColors.accentRose,
                  shadowColor: student.checkedIn
                    ? NexusColors.accentCyan
                    : NexusColors.accentRose,
                },
              ]}
            />
            <Text style={styles.studentName} numberOfLines={1}>
              {student.name}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: NexusRadius.lg,
    overflow: 'hidden',
    backgroundColor: 'rgba(6, 182, 212, 0.03)',
    borderWidth: 1,
    borderColor: NexusColors.borderGlass,
    padding: NexusSpacing.md,
  },
  summary: {
    flexDirection: 'row',
    gap: NexusSpacing.lg,
    marginBottom: NexusSpacing.md,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  summaryText: {
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.textSecondary,
    fontWeight: NexusFonts.weights.medium,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: NexusSpacing.sm,
  },
  studentItem: {
    alignItems: 'center',
    width: 56,
    gap: NexusSpacing.xs,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 4,
    elevation: 4,
  },
  studentName: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
    textAlign: 'center',
  },
})
