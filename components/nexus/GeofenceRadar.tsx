import React, { useEffect, useRef } from 'react'
import { View, Animated, StyleSheet } from 'react-native'
import { NexusColors, NexusRadius } from '../../constants/theme'

interface Coords {
  lat: number
  lng: number
}

interface GeofenceRadarProps {
  studentCoords: Coords | null
  geofenceCenter: Coords
  geofenceRadius: number // metres
  sessionActive: boolean
}

const CANVAS_SIZE = 280
const CENTER = CANVAS_SIZE / 2

/** Map a real-world offset (metres) to canvas pixels. Display radius = 40% of canvas. */
function toCanvas(
  studentCoords: Coords | null,
  geofenceCenter: Coords,
  geofenceRadius: number
): { x: number; y: number } | null {
  if (!studentCoords) return null
  const scale = (CANVAS_SIZE * 0.4) / geofenceRadius
  // Approximate metres per degree
  const metersPerDegLat = 111320
  const metersPerDegLng = 111320 * Math.cos((geofenceCenter.lat * Math.PI) / 180)
  const dx = (studentCoords.lng - geofenceCenter.lng) * metersPerDegLng * scale
  const dy = -(studentCoords.lat - geofenceCenter.lat) * metersPerDegLat * scale
  return { x: CENTER + dx, y: CENTER + dy }
}

function PulsingDot({ x, y, color }: { x: number; y: number; color: string }) {
  const pulse = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 2.2, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    )
    anim.start()
    return () => anim.stop()
  }, [pulse])

  return (
    <View style={[styles.dotContainer, { left: x - 8, top: y - 8 }]}>
      <Animated.View
        style={[
          styles.dotRing,
          { borderColor: color, transform: [{ scale: pulse }], opacity: 0.35 },
        ]}
      />
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  )
}

function SweepLine() {
  const rotation = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    )
    anim.start()
    return () => anim.stop()
  }, [rotation])

  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })

  return (
    <Animated.View
      style={[
        styles.sweepContainer,
        { transform: [{ rotate }] },
      ]}
    >
      <View style={styles.sweepLine} />
    </Animated.View>
  )
}

export function GeofenceRadar({
  studentCoords,
  geofenceCenter,
  geofenceRadius,
  sessionActive,
}: GeofenceRadarProps) {
  const geofenceColor = sessionActive
    ? NexusColors.accentCyan
    : NexusColors.textDisabled

  const studentPos = toCanvas(studentCoords, geofenceCenter, geofenceRadius)

  return (
    <View style={styles.canvas}>
      {/* Background rings */}
      {[0.25, 0.5, 0.75, 1].map((ratio) => (
        <View
          key={ratio}
          style={[
            styles.ring,
            {
              width: CANVAS_SIZE * ratio,
              height: CANVAS_SIZE * ratio,
              borderRadius: (CANVAS_SIZE * ratio) / 2,
              borderColor: 'rgba(148, 163, 184, 0.08)',
              left: CENTER - (CANVAS_SIZE * ratio) / 2,
              top: CENTER - (CANVAS_SIZE * ratio) / 2,
            },
          ]}
        />
      ))}

      {/* Geofence boundary circle (40% of canvas = geofenceRadius) */}
      <View
        style={[
          styles.ring,
          {
            width: CANVAS_SIZE * 0.8,
            height: CANVAS_SIZE * 0.8,
            borderRadius: (CANVAS_SIZE * 0.8) / 2,
            borderColor: geofenceColor,
            borderWidth: 2,
            left: CENTER - (CANVAS_SIZE * 0.8) / 2,
            top: CENTER - (CANVAS_SIZE * 0.8) / 2,
          },
        ]}
      />

      {/* Radar sweep */}
      <SweepLine />

      {/* Center dot (geofence center) */}
      <View style={[styles.centerDot, { backgroundColor: geofenceColor }]} />

      {/* Student dot */}
      {studentPos && (
        <PulsingDot x={studentPos.x} y={studentPos.y} color={NexusColors.accentCyan} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  canvas: {
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    backgroundColor: 'rgba(6, 182, 212, 0.03)',
    borderRadius: NexusRadius.full,
    borderWidth: 1,
    borderColor: NexusColors.borderGlass,
    position: 'relative',
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
  },
  sweepContainer: {
    position: 'absolute',
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sweepLine: {
    position: 'absolute',
    width: CANVAS_SIZE / 2,
    height: 1.5,
    right: CENTER,
    top: CENTER - 0.75,
    backgroundColor: 'rgba(6, 182, 212, 0.5)',
    transformOrigin: 'right center',
  },
  centerDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    left: CENTER - 4,
    top: CENTER - 4,
  },
  dotContainer: {
    position: 'absolute',
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'absolute',
  },
  dotRing: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    position: 'absolute',
  },
})
