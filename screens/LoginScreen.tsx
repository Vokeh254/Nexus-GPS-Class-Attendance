import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import AuthService from '@/services/AuthService';
import { NexusColors, NexusFonts, NexusSpacing, NexusRadius } from '@/constants/theme';
import MagneticButton from '@/components/MagneticButton';
import StardustTrail from '@/components/StardustTrail';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [showBiometricDemo] = useState(Platform.OS === 'web');

  useEffect(() => {
    checkBiometricAvailability();
  }, []);

  const checkBiometricAvailability = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const { getItemAsync } = await import('expo-secure-store');
      const storedSession = await getItemAsync('supabase_session').catch(() => null);
      setBiometricAvailable(hasHardware && isEnrolled && !!storedSession);
    } catch {
      setBiometricAvailable(false);
    }
  };

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setIsLoading(true);
    try {
      const result = await AuthService.signIn(email.trim(), password);
      if (result.success) {
        router.replace('/(tabs)');
      } else {
        Alert.alert('Sign In Failed', result.error || 'Invalid credentials');
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricSignIn = async () => {
    if (Platform.OS === 'web') {
      Alert.alert(
        'Biometric Authentication',
        'Biometric authentication is only available on native devices.',
        [{ text: 'OK' }]
      );
      return;
    }
    try {
      const result = await AuthService.authenticateWithBiometric();
      if (result.success) {
        router.replace('/(tabs)');
      } else {
        Alert.alert('Biometric Failed', result.error || 'Please try again');
      }
    } catch {
      Alert.alert('Error', 'Biometric authentication failed');
    }
  };

  const showBiometric = biometricAvailable || showBiometricDemo;

  return (
    <StardustTrail>
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={NexusColors.bgPrimary} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.flex}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand mark */}
          <View style={s.brandRow}>
            <View style={s.logoBox}>
              <Text style={s.logoGlyph}>⬡</Text>
            </View>
            <View>
              <Text style={s.brandName}>NEXUS</Text>
              <Text style={s.brandSub}>Attendance System</Text>
            </View>
          </View>

          {/* Headline */}
          <Text style={s.headline}>Welcome{'\n'}back.</Text>
          <Text style={s.subline}>Sign in to your account to continue.</Text>

          {/* Card */}
          <View style={s.card}>
            {/* Email */}
            <Text style={s.label}>EMAIL ADDRESS</Text>
            <View style={s.inputRow}>
              <Ionicons name="mail-outline" size={18} color={NexusColors.textSecondary} style={s.inputIcon} />
              <TextInput
                style={s.input}
                placeholder="you@university.edu"
                placeholderTextColor={NexusColors.textDisabled}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password */}
            <Text style={[s.label, { marginTop: NexusSpacing.lg }]}>PASSWORD</Text>
            <View style={s.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color={NexusColors.textSecondary} style={s.inputIcon} />
              <TextInput
                style={s.input}
                placeholder="••••••••••••"
                placeholderTextColor={NexusColors.textDisabled}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={s.eyeBtn}>
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={18}
                  color={NexusColors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Remember me + Forgot */}
            <View style={s.rememberRow}>
              <TouchableOpacity style={s.rememberLeft} onPress={() => setRememberMe(!rememberMe)}>
                <View style={[s.checkbox, rememberMe && s.checkboxActive]}>
                  {rememberMe && <Ionicons name="checkmark" size={12} color={NexusColors.bgPrimary} />}
                </View>
                <Text style={s.rememberText}>Remember me</Text>
              </TouchableOpacity>
              <TouchableOpacity>
                <Text style={s.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            </View>

            {/* Sign in button + biometric */}
            <View style={s.btnRow}>
              <MagneticButton
                label={isLoading ? 'Signing in…' : 'Sign In'}
                onPress={handleSignIn}
                disabled={isLoading}
                loading={isLoading}
                icon="arrow-forward"
                fullWidth={!showBiometric}
                style={showBiometric ? { flex: 1 } : undefined}
              />

              {showBiometric && (
                <TouchableOpacity style={s.biometricBtn} onPress={handleBiometricSignIn} activeOpacity={0.8}>
                  <Ionicons name="finger-print" size={26} color={NexusColors.accentCyan} />
                </TouchableOpacity>
              )}
            </View>

            {/* Divider */}
            <View style={s.divider}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>OR</Text>
              <View style={s.dividerLine} />
            </View>

            {/* Google */}
            <TouchableOpacity
              style={s.googleBtn}
              onPress={() => Alert.alert('Coming Soon', 'Google Sign In will be available soon!')}
              activeOpacity={0.8}
            >
              <Text style={s.googleG}>G</Text>
              <Text style={s.googleText}>Continue with Google</Text>
            </TouchableOpacity>

            {/* Footer */}
            <Text style={s.footer}>
              Don't have an account?{' '}
              <Text style={s.footerLink} onPress={() => router.push('/register')}>
                Sign Up
              </Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
    </StardustTrail>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: NexusColors.bgPrimary,
  },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: NexusSpacing['2xl'],
    paddingTop: 64,
    paddingBottom: 48,
  },

  // Brand
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.md,
    marginBottom: NexusSpacing['3xl'],
  },
  logoBox: {
    width: 44,
    height: 44,
    borderRadius: NexusRadius.md,
    backgroundColor: NexusColors.bgCardSolid,
    borderWidth: 1,
    borderColor: NexusColors.borderGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlyph: {
    fontSize: 22,
    color: NexusColors.accentCyan,
  },
  brandName: {
    fontSize: NexusFonts.sizes.base,
    fontWeight: NexusFonts.weights.black,
    color: NexusColors.accentCyan,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
  brandSub: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
    letterSpacing: NexusFonts.letterSpacing.wide,
  },

  // Headline
  headline: {
    fontSize: NexusFonts.sizes['4xl'],
    fontWeight: NexusFonts.weights.black,
    color: NexusColors.textPrimary,
    lineHeight: 44,
    marginBottom: NexusSpacing.sm,
  },
  subline: {
    fontSize: NexusFonts.sizes.base,
    color: NexusColors.textSecondary,
    marginBottom: NexusSpacing['3xl'],
  },

  // Card
  card: {
    backgroundColor: NexusColors.bgCard,
    borderRadius: NexusRadius['2xl'],
    borderWidth: 1,
    borderColor: NexusColors.borderGlass,
    padding: NexusSpacing['2xl'],
  },

  // Inputs
  label: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textSecondary,
    letterSpacing: NexusFonts.letterSpacing.widest,
    marginBottom: NexusSpacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NexusColors.bgCardSolid,
    borderRadius: NexusRadius.lg,
    borderWidth: 1,
    borderColor: NexusColors.borderGlass,
    paddingHorizontal: NexusSpacing.lg,
    paddingVertical: NexusSpacing.md,
  },
  inputIcon: { marginRight: NexusSpacing.sm },
  input: {
    flex: 1,
    fontSize: NexusFonts.sizes.base,
    color: NexusColors.textPrimary,
    fontWeight: NexusFonts.weights.medium,
  },
  eyeBtn: { padding: NexusSpacing.xs },

  // Remember / forgot
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: NexusSpacing.lg,
    marginBottom: NexusSpacing['2xl'],
  },
  rememberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.sm,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: NexusRadius.sm - 2,
    borderWidth: 1.5,
    borderColor: NexusColors.borderGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: NexusColors.accentCyan,
    borderColor: NexusColors.accentCyan,
  },
  rememberText: {
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.textSecondary,
    fontWeight: NexusFonts.weights.medium,
  },
  forgotText: {
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.accentCyan,
    fontWeight: NexusFonts.weights.semibold,
  },

  // Buttons
  btnRow: {
    flexDirection: 'row',
    gap: NexusSpacing.md,
    marginBottom: NexusSpacing['2xl'],
  },
  signInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NexusColors.accentCyan,
    borderRadius: NexusRadius.lg,
    paddingVertical: NexusSpacing.lg,
    paddingHorizontal: NexusSpacing['2xl'],
    shadowColor: NexusColors.accentCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  btnDisabled: { opacity: 0.6 },
  signInBtnText: {
    fontSize: NexusFonts.sizes.md,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.bgPrimary,
  },
  biometricBtn: {
    width: 56,
    height: 56,
    borderRadius: NexusRadius.lg,
    backgroundColor: NexusColors.bgCardSolid,
    borderWidth: 1,
    borderColor: NexusColors.borderGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.md,
    marginBottom: NexusSpacing['2xl'],
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: NexusColors.borderGlass,
  },
  dividerText: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textDisabled,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },

  // Google
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: NexusSpacing.md,
    backgroundColor: NexusColors.bgCardSolid,
    borderRadius: NexusRadius.lg,
    borderWidth: 1,
    borderColor: NexusColors.borderGlass,
    paddingVertical: NexusSpacing.lg,
    marginBottom: NexusSpacing['2xl'],
  },
  googleG: {
    fontSize: NexusFonts.sizes.lg,
    fontWeight: NexusFonts.weights.black,
    color: '#4285F4',
  },
  googleText: {
    fontSize: NexusFonts.sizes.base,
    fontWeight: NexusFonts.weights.semibold,
    color: NexusColors.textPrimary,
  },

  // Footer
  footer: {
    textAlign: 'center',
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.textSecondary,
  },
  footerLink: {
    color: NexusColors.accentCyan,
    fontWeight: NexusFonts.weights.bold,
  },
});
