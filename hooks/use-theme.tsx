import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

type Theme = 'light' | 'dark';

export const lightColors = {
  bg: '#F5F7FA',
  card: '#FFFFFF',
  cardBorder: '#E8EAF0',
  text: '#1A1A2E',
  subtext: '#687076',
  primary: '#6C63FF',
  primaryDark: '#5B54D6',
  primaryGradient: ['#6C63FF', '#A855F7'] as string[],
  secondary: '#A855F7',
  accent: '#6C63FF',
  accentSoft: '#EEF0FF',
  tabBar: '#FFFFFF',
  tabBarBorder: '#E8EAF0',
  header: '#FFFFFF',
  inputBg: '#F8FAFC',
  inputBorder: '#E8EAF0',
  danger: '#EF4444',
  success: '#22C55E',
  warning: '#F59E0B',
  overlay: 'rgba(108,99,255,0.08)',
};

export const darkColors = {
  bg: '#0F0F1E',
  card: '#1A1A2E',
  cardBorder: '#2A2A3E',
  text: '#E8F4FF',
  subtext: '#9BA1A6',
  primary: '#8B84FF',
  primaryDark: '#6C63FF',
  primaryGradient: ['#6C63FF', '#A855F7'] as string[],
  secondary: '#C084FC',
  accent: '#8B84FF',
  accentSoft: '#1A1A35',
  tabBar: '#12122A',
  tabBarBorder: '#2A2A3E',
  header: '#12122A',
  inputBg: '#1A1A2E',
  inputBorder: '#2A2A3E',
  danger: '#FF4D4D',
  success: '#22C55E',
  warning: '#F59E0B',
  overlay: 'rgba(139,132,255,0.08)',
};

type Colors = typeof lightColors;

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
  colors: Colors;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
  isDark: false,
  colors: lightColors,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useSystemColorScheme();
  const [theme, setTheme] = useState<Theme>(system === 'dark' ? 'dark' : 'light');

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  const isDark = theme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
