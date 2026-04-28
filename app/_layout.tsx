import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { ThemeProvider, useTheme } from '@/hooks/use-theme';
import { useAuthGate } from '@/navigation/AppNavigator';
import OrbitalPreloader from '@/components/OrbitalPreloader';

function RootLayoutInner() {
  const { isAuthenticated, isLoading } = useAuthGate();
  const { isDark } = useTheme();

  // Always play the preloader on cold launch — navigation is blocked until it finishes
  const [preloaderDone, setPreloaderDone] = useState(false);

  useEffect(() => {
    // Only navigate once BOTH the preloader has finished AND auth has resolved
    if (!preloaderDone || isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
    }
    // If authenticated, expo-router will land on (tabs) automatically
  }, [preloaderDone, isLoading, isAuthenticated]);

  if (!preloaderDone) {
    return <OrbitalPreloader onComplete={() => setPreloaderDone(true)} />;
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(tabs)/achievements" />
        <Stack.Screen name="student-privacy" />
        <Stack.Screen name="student-help" />
        <Stack.Screen name="student-terms" />
        <Stack.Screen name="instructor-privacy" />
        <Stack.Screen name="instructor-help" />
        <Stack.Screen name="instructor-terms" />
        <Stack.Screen name="unit-detail" />
        <Stack.Screen name="student-unit-detail" />
      </Stack>
      <StatusBar style="light" backgroundColor="#0B1120" />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutInner />
    </ThemeProvider>
  );
}
