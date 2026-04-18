import { Platform } from 'react-native';

// Modern blue theme matching the reference design
export const Colors = {
  light: {
    text: '#1A1A2E',
    background: '#F0F4F8',
    card: '#FFFFFF',
    cardBorder: '#E8EAF0',
    tint: '#4169E1',
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: '#4169E1',
    primary: '#4169E1',
    primaryDark: '#3457C0',
    primaryLight: '#5B7FE8',
    secondary: '#A855F7',
    success: '#22C55E',
    error: '#EF4444',
    warning: '#F59E0B',
    danger: '#E53E3E',
    subtext: '#687076',
    inputBg: '#F8FAFC',
    inputBorder: '#E8EAF0',
    gradientStart: '#4169E1',
    gradientEnd: '#5B7FE8',
    placeholderText: '#9CA3AF',
    header: '#FFFFFF',
    tabBar: '#FFFFFF',
    tabBarBorder: '#E8EAF0',
    bg: '#F0F4F8',
  },
  dark: {
    text: '#E8F4FF',
    background: '#0F1419',
    card: '#1A1F2E',
    cardBorder: '#2A2F3E',
    tint: '#5B7FE8',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#5B7FE8',
    primary: '#5B7FE8',
    primaryDark: '#4169E1',
    primaryLight: '#7A9BF0',
    secondary: '#C084FC',
    success: '#22C55E',
    error: '#FF4D4D',
    warning: '#F59E0B',
    danger: '#E53E3E',
    subtext: '#9BA1A6',
    inputBg: '#1A1F2E',
    inputBorder: '#2A2F3E',
    gradientStart: '#4169E1',
    gradientEnd: '#5B7FE8',
    placeholderText: '#6B7280',
    header: '#1A1F2E',
    tabBar: '#1A1F2E',
    tabBarBorder: '#2A2F3E',
    bg: '#0F1419',
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

// ─── Nexus Attendance UI — Design Token System ───────────────────────────────
// These exports extend theme.ts without modifying the existing Colors/Fonts above.

export const NexusColors = {
  // Backgrounds
  bgPrimary:    '#0B1120',
  bgCard:       'rgba(30, 41, 59, 0.6)',
  bgCardSolid:  '#1E293B',

  // Borders
  borderGlass:  'rgba(148, 163, 184, 0.1)',
  borderGlow:   'rgba(6, 182, 212, 0.3)',

  // Accent palette
  accentCyan:    '#06B6D4',
  accentAmber:   '#F59E0B',
  accentEmerald: '#10B981',
  accentRose:    '#F43F5E',
  accentIndigo:  '#6366F1',

  // Text
  textPrimary:   '#F8FAFC',
  textSecondary: '#94A3B8',
  textDisabled:  '#475569',

  // Gradients (string descriptors for LinearGradient)
  gradientGlow:  ['rgba(6,182,212,0.3)', 'rgba(99,102,241,0.2)'],
  gradientCyan:  ['#06B6D4', '#0891B2'],
  gradientAmber: ['#F59E0B', '#D97706'],
  gradientCard:  ['rgba(30,41,59,0.8)', 'rgba(15,23,42,0.9)'],

  // Status bar
  gpsActive:     '#06B6D4',
  gpsSearching:  '#F59E0B',
  gpsDisabled:   '#F43F5E',
} as const

export const NexusFonts = {
  family:   'Inter',
  fallback: 'system-ui, -apple-system, sans-serif',

  sizes: {
    xs:    10,
    sm:    12,
    base:  14,
    md:    16,
    lg:    18,
    xl:    20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },

  weights: {
    regular:   '400' as const,
    medium:    '500' as const,
    semibold:  '600' as const,
    bold:      '700' as const,
    extrabold: '800' as const,
    black:     '900' as const,
  },

  letterSpacing: {
    tight:  -0.5,
    normal:  0,
    wide:    0.5,
    wider:   1.0,
    widest:  2.0,
  },
} as const

export const NexusSpacing = {
  xs:    4,
  sm:    8,
  md:    12,
  lg:    16,
  xl:    20,
  '2xl': 24,
  '3xl': 32,
} as const

export const NexusRadius = {
  sm:    8,
  md:    12,
  lg:    16,
  xl:    20,
  '2xl': 24,
  full:  9999,
} as const
