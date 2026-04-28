import React, { useEffect, useRef, useCallback, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Path } from 'react-native-svg'
import { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { NexusColors, NexusFonts, NexusSpacing, NexusRadius } from '../../constants/theme'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

const TAB_CONFIG: Record<
  string,
  { icon: IoniconName; iconActive: IoniconName; label: string; color: string }
> = {
  index:      { icon: 'home-outline',      iconActive: 'home',       label: 'Home',      color: '#06B6D4' },
  attendance: { icon: 'radio-outline',     iconActive: 'radio',      label: 'Radar',     color: '#A78BFA' },
  analytics:  { icon: 'bar-chart-outline', iconActive: 'bar-chart',  label: 'Analytics', color: '#34D399' },
  profile:    { icon: 'person-outline',    iconActive: 'person',     label: 'Profile',   color: '#F472B6' },
}

const VISIBLE_TABS = ['index', 'attendance', 'analytics', 'profile']
const { width: SCREEN_WIDTH } = Dimensions.get('window')

const BAR_HEIGHT   = 64
const BUBBLE_SIZE  = 52
const NOTCH_WIDTH  = 88
const NOTCH_DEPTH  = 28
const TAB_WIDTH    = SCREEN_WIDTH / VISIBLE_TABS.length

// ── SVG notch bar path ────────────────────────────────────────────────────────
// Draws the bar with a smooth bezier notch centred at `cx`
function buildPath(cx: number, w: number, h: number): string {
  const nw = NOTCH_WIDTH / 2   // half notch width
  const nd = NOTCH_DEPTH       // depth of notch
  const r  = 20                // corner radius of bar top

  // left edge → left notch shoulder → curve down → curve up → right notch shoulder → right edge
  return [
    `M 0 ${r}`,
    `Q 0 0 ${r} 0`,
    `L ${cx - nw - 10} 0`,
    `C ${cx - nw + 10} 0 ${cx - nw + 10} ${nd} ${cx} ${nd}`,
    `C ${cx + nw - 10} ${nd} ${cx + nw - 10} 0 ${cx + nw + 10} 0`,
    `L ${w - r} 0`,
    `Q ${w} 0 ${w} ${r}`,
    `L ${w} ${h}`,
    `L 0 ${h}`,
    `Z`,
  ].join(' ')
}

// ── Tab bar ───────────────────────────────────────────────────────────────────
export function NexusTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const visibleRoutes = state.routes.filter((r) => VISIBLE_TABS.includes(r.name))

  const activeVisIdx = visibleRoutes.findIndex(
    (r) => r.key === state.routes[state.index]?.key
  )
  const activeConfig = TAB_CONFIG[visibleRoutes[activeVisIdx]?.name] ?? TAB_CONFIG['index']

  // Animated centre-x of the notch + bubble
  const notchX = useRef(
    new Animated.Value(TAB_WIDTH * activeVisIdx + TAB_WIDTH / 2)
  ).current

  // Animated colour interpolation index (0 → n-1)
  const bubbleScale = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const targetX = TAB_WIDTH * activeVisIdx + TAB_WIDTH / 2
    Animated.spring(notchX, {
      toValue: targetX,
      useNativeDriver: false, // must be false — drives SVG path + layout
      tension: 180,
      friction: 18,
    }).start()

    // Bounce the bubble on tab change
    Animated.sequence([
      Animated.timing(bubbleScale, { toValue: 0.82, duration: 80, useNativeDriver: true }),
      Animated.spring(bubbleScale, { toValue: 1, useNativeDriver: true, tension: 220, friction: 6 }),
    ]).start()
  }, [activeVisIdx])

  const bottomPad = Math.max(insets.bottom, 8)
  const totalHeight = BAR_HEIGHT + bottomPad

  return (
    <View style={[styles.container, { height: totalHeight + BUBBLE_SIZE / 2 }]}>
      {/* ── Animated SVG bar with notch ── */}
      <Animated.View style={[styles.svgWrapper, { height: totalHeight }]}>
        <AnimatedSvgBar
          notchX={notchX}
          width={SCREEN_WIDTH}
          height={totalHeight}
          color={NexusColors.bgCardSolid}
        />
      </Animated.View>

      {/* ── Floating bubble (active icon) ── */}
      <Animated.View
        style={[
          styles.bubble,
          {
            backgroundColor: activeConfig.color,
            left: Animated.subtract(notchX, BUBBLE_SIZE / 2),
            top: 0,
            transform: [{ scale: bubbleScale }],
            shadowColor: activeConfig.color,
          },
        ]}
      >
        <Ionicons name={activeConfig.iconActive} size={24} color="#fff" />
      </Animated.View>

      {/* ── Tab touch targets ── */}
      <View style={[styles.tabRow, { height: totalHeight }]}>
        {visibleRoutes.map((route, visIdx) => {
          const { options } = descriptors[route.key]
          const routeIndex  = state.routes.indexOf(route)
          const isActive    = state.index === routeIndex
          const config      = TAB_CONFIG[route.name] ?? {
            icon: 'ellipse-outline' as IoniconName,
            iconActive: 'ellipse' as IoniconName,
            label: route.name,
            color: NexusColors.accentCyan,
          }

          return (
            <TabItem
              key={route.key}
              isActive={isActive}
              config={config}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                })
                if (!isActive && !event.defaultPrevented) navigation.navigate(route.name)
              }}
              onLongPress={() =>
                navigation.emit({ type: 'tabLongPress', target: route.key })
              }
            />
          )
        })}
      </View>
    </View>
  )
}

// ── Animated SVG bar ──────────────────────────────────────────────────────────
function AnimatedSvgBar({
  notchX,
  width,
  height,
  color,
}: {
  notchX: Animated.Value
  width: number
  height: number
  color: string
}) {
  const [path, setPath] = useState(() => {
    const initX = (notchX as any)._value ?? TAB_WIDTH / 2
    return buildPath(initX, width, height)
  })

  useEffect(() => {
    const id = notchX.addListener(({ value }) => {
      setPath(buildPath(value, width, height))
    })
    return () => notchX.removeListener(id)
  }, [notchX, width, height])

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Path d={path} fill={color} />
    </Svg>
  )
}

// ── Single tab item ───────────────────────────────────────────────────────────
function TabItem({
  isActive,
  config,
  onPress,
  onLongPress,
  accessibilityLabel,
}: {
  isActive: boolean
  config: typeof TAB_CONFIG[string]
  onPress: () => void
  onLongPress: () => void
  accessibilityLabel?: string
}) {
  const labelOp = useRef(new Animated.Value(isActive ? 0 : 1)).current
  const iconOp  = useRef(new Animated.Value(isActive ? 0 : 1)).current

  useEffect(() => {
    // Active tab: hide icon+label (bubble takes over); inactive: show them
    Animated.parallel([
      Animated.timing(labelOp, {
        toValue: isActive ? 0 : 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(iconOp, {
        toValue: isActive ? 0 : 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start()
  }, [isActive])

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={isActive ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel ?? config.label}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tab}
      activeOpacity={0.7}
    >
      {/* Icon — hidden when active (bubble shows instead) */}
      <Animated.View style={{ opacity: iconOp }}>
        <Ionicons
          name={config.icon}
          size={22}
          color={NexusColors.textSecondary}
        />
      </Animated.View>

      {/* Label */}
      <Animated.Text
        style={[
          styles.label,
          {
            color: isActive ? config.color : NexusColors.textSecondary,
            opacity: labelOp,
          },
        ]}
      >
        {config.label}
      </Animated.Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: SCREEN_WIDTH,
  },
  svgWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  bubble: {
    position: 'absolute',
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    // Shadow only on the bubble
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
      },
      android: { elevation: 10 },
    }),
  },
  tabRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: NexusSpacing.sm,
    gap: 3,
    // push content down so it sits in the bar, not behind the bubble
    paddingTop: BUBBLE_SIZE / 2 + 4,
  },
  label: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.medium,
    letterSpacing: 0.2,
  },
})
