import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { NexusColors, NexusFonts, NexusSpacing, NexusRadius } from '../../constants/theme'

interface DataPoint {
  label: string
  value: number
}

interface StatChartProps {
  type: 'line' | 'bar'
  data: DataPoint[]
  title?: string
}

function BarChart({ data }: { data: DataPoint[] }) {
  const maxValue = Math.max(...data.map((d) => d.value), 1)

  return (
    <View style={styles.barContainer}>
      {data.map((item, index) => {
        const widthPct = (item.value / maxValue) * 100
        return (
          <View key={index} style={styles.barRow}>
            <Text style={styles.barLabel} numberOfLines={1}>
              {item.label}
            </Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${widthPct}%` }]} />
            </View>
            <Text style={styles.barValue}>{item.value}</Text>
          </View>
        )
      })}
    </View>
  )
}

function LineChart({ data }: { data: DataPoint[] }) {
  const maxValue = Math.max(...data.map((d) => d.value), 1)
  const CHART_HEIGHT = 100
  const CHART_WIDTH_PER_POINT = 40

  if (data.length < 2) {
    return <BarChart data={data} />
  }

  const points = data.map((item, i) => ({
    x: i * CHART_WIDTH_PER_POINT + CHART_WIDTH_PER_POINT / 2,
    y: CHART_HEIGHT - (item.value / maxValue) * (CHART_HEIGHT - 10),
    label: item.label,
    value: item.value,
  }))

  const totalWidth = data.length * CHART_WIDTH_PER_POINT

  return (
    <View>
      <View style={[styles.lineCanvas, { height: CHART_HEIGHT, width: totalWidth }]}>
        {/* Dots */}
        {points.map((pt, i) => (
          <View
            key={i}
            style={[
              styles.lineDot,
              { left: pt.x - 4, top: pt.y - 4 },
            ]}
          />
        ))}
        {/* Connecting lines using thin Views */}
        {points.slice(0, -1).map((pt, i) => {
          const next = points[i + 1]
          const dx = next.x - pt.x
          const dy = next.y - pt.y
          const length = Math.sqrt(dx * dx + dy * dy)
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI
          return (
            <View
              key={`line-${i}`}
              style={[
                styles.lineSegment,
                {
                  width: length,
                  left: pt.x,
                  top: pt.y - 1,
                  transform: [{ rotate: `${angle}deg` }],
                },
              ]}
            />
          )
        })}
      </View>
      {/* X-axis labels */}
      <View style={[styles.lineLabels, { width: totalWidth }]}>
        {points.map((pt, i) => (
          <Text key={i} style={[styles.lineLabel, { width: CHART_WIDTH_PER_POINT }]} numberOfLines={1}>
            {pt.label}
          </Text>
        ))}
      </View>
    </View>
  )
}

export function StatChart({ type, data, title }: StatChartProps) {
  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      {type === 'bar' ? <BarChart data={data} /> : <LineChart data={data} />}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: NexusSpacing.md,
  },
  title: {
    fontSize: NexusFonts.sizes.sm,
    fontWeight: NexusFonts.weights.semibold,
    color: NexusColors.textSecondary,
    letterSpacing: NexusFonts.letterSpacing.widest,
    textTransform: 'uppercase',
    marginBottom: NexusSpacing.md,
  },
  // Bar chart
  barContainer: {
    gap: NexusSpacing.sm,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.sm,
  },
  barLabel: {
    width: 64,
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
    textAlign: 'right',
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    borderRadius: NexusRadius.full,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: NexusColors.accentCyan,
    borderRadius: NexusRadius.full,
  },
  barValue: {
    width: 32,
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
    textAlign: 'right',
  },
  // Line chart
  lineCanvas: {
    position: 'relative',
    overflow: 'visible',
  },
  lineDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: NexusColors.accentCyan,
    shadowColor: NexusColors.accentCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  lineSegment: {
    position: 'absolute',
    height: 2,
    backgroundColor: NexusColors.accentCyan,
    opacity: 0.6,
    transformOrigin: 'left center',
  },
  lineLabels: {
    flexDirection: 'row',
    marginTop: NexusSpacing.xs,
  },
  lineLabel: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
    textAlign: 'center',
  },
})
