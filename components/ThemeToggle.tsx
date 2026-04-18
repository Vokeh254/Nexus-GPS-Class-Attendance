import { TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { useTheme } from '@/hooks/use-theme';

export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();
  const anim = useRef(new Animated.Value(isDark ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: isDark ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [isDark]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [2, 22] });
  const trackBg = anim.interpolate({ inputRange: [0, 1], outputRange: ['#CBD5E1', '#6C63FF'] });

  return (
    <TouchableOpacity onPress={toggleTheme} activeOpacity={0.8} style={styles.wrap}>
      <Animated.View style={[styles.track, { backgroundColor: trackBg }]}>
        <Animated.View style={[styles.thumb, { transform: [{ translateX }] }]}>
          <Animated.Text style={styles.icon}>{isDark ? '🌙' : '☀️'}</Animated.Text>
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 2 },
  track: { width: 50, height: 28, borderRadius: 14, justifyContent: 'center' },
  thumb: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 3, elevation: 2,
  },
  icon: { fontSize: 12 },
});
