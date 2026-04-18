import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { NexusColors, NexusFonts, NexusSpacing, NexusRadius } from '../../constants/theme'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

const TAB_CONFIG: Record<string, { icon: IoniconName; iconActive: IoniconName; label: string }> = {
  index:      { icon: 'home-outline',      iconActive: 'home',       label: 'Home' },
  attendance: { icon: 'radio-outline',     iconActive: 'radio',      label: 'Radar' },
  analytics:  { icon: 'bar-chart-outline', iconActive: 'bar-chart',  label: 'Analytics' },
  profile:    { icon: 'person-outline',    iconActive: 'person',     label: 'Profile' },
}

export function NexusTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View style={styles.container}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key]
        const isActive = state.index === index
        const config = TAB_CONFIG[route.name] ?? {
          icon: 'ellipse-outline' as IoniconName,
          iconActive: 'ellipse' as IoniconName,
          label: route.name,
        }

        const iconColor = isActive ? NexusColors.accentCyan : NexusColors.textSecondary
        const iconName = isActive ? config.iconActive : config.icon

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
          if (!isActive && !event.defaultPrevented) {
            navigation.navigate(route.name)
          }
        }

        const onLongPress = () => {
          navigation.emit({ type: 'tabLongPress', target: route.key })
        }

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isActive ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? config.label}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tab}
          >
            {isActive && <View style={styles.activeGlow} />}
            <Ionicons name={iconName} size={22} color={iconColor} />
            <Text style={[styles.label, { color: iconColor, fontWeight: isActive ? NexusFonts.weights.bold : NexusFonts.weights.regular }]}>
              {config.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: NexusColors.bgCard,
    borderTopWidth: 1,
    borderTopColor: NexusColors.borderGlass,
    paddingBottom: NexusSpacing.sm,
    paddingTop: NexusSpacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: NexusSpacing.xs,
    position: 'relative',
  },
  activeGlow: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: 2,
    backgroundColor: NexusColors.accentCyan,
    borderRadius: NexusRadius.full,
    shadowColor: NexusColors.accentCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  label: {
    fontSize: NexusFonts.sizes.xs,
    marginTop: 2,
  },
})
