import { useEffect } from 'react';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import LoginScreen from '../screens/LoginScreen';

export default function LoginRoute() {
  useEffect(() => {
    // If already authenticated, skip login
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/(tabs)');
    });
  }, []);

  return <LoginScreen />;
}
