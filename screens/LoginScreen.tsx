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
  Modal,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import AuthService from '@/services/AuthService';
import { supabase } from '@/lib/supabase';
import { NexusColors, NexusFonts, NexusSpacing, NexusRadius } from '@/constants/theme';
import MagneticButton from '@/components/MagneticButton';
import StardustTrail from '@/components/StardustTrail';

// Required for expo-auth-session to work with web browser redirects
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe]     = useState(false);
  const [isLoading, setIsLoading]       = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Biometric
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType]           = useState<'fingerprint' | 'face' | 'none'>('none');

  // Forgot password modal
  const [forgotVisible, setForgotVisible]   = useState(false);
  const [forgotEmail, setForgotEmail]       = useState('');
  const [forgotLoading, setForgotLoading]   = useState(false);
  const [forgotSent, setForgotSent]         = useState(false);

  useEffect(() => {
    checkBiometricAvailability();
  }, []);

  const checkBiometricAvailability = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled  = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) return;

      // Detect type
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType('face');
      } else {
        setBiometricType('fingerprint');
      }
      setBiometricAvailable(true);
    } catch {
      setBiometricAvailable(false);
    }
  };

  // ── Sign in with email/password ──────────────────────────────────────────
  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setIsLoading(true);
    try {
      const result = await AuthService.signIn(email.trim(), password);
      if (result.success) {
        router.replace('/(tabs)');
      } else {
        Alert.alert('Sign In Failed', result.error || 'Invalid credentials. Please try again.');
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Biometric sign in ────────────────────────────────────────────────────
  const handleBiometricSignIn = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not available', 'Biometric authentication requires a native device.');
      return;
    }
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: biometricType === 'face'
          ? 'Use Face ID to sign in'
          : 'Use your fingerprint to sign in',
        fallbackLabel: 'Use password instead',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (!result.success) {
        if (result.error !== 'user_cancel') {
          Alert.alert(
            'Authentication failed',
            'Biometric verification failed. Please sign in with your password.'
          );
        }
        return;
      }

      // Try to restore the stored session
      const session = await AuthService.getSession();
      if (session) {
        router.replace('/(tabs)');
      } else {
        Alert.alert(
          'No saved session',
          'Please sign in with your email and password first. After that, biometric sign-in will be available.'
        );
      }
    } catch {
      Alert.alert('Error', 'Biometric authentication failed. Please use your password.');
    }
  };

  // ── Forgot password ──────────────────────────────────────────────────────
  const handleForgotPassword = async () => {
    const trimmed = forgotEmail.trim();
    if (!trimmed || !trimmed.includes('@')) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: 'nexusattendance://reset-password',
      });
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        setForgotSent(true);
      }
    } catch {
      Alert.alert('Error', 'Could not send reset email. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgotModal = () => {
    setForgotVisible(false);
    setForgotEmail('');
    setForgotSent(false);
    setForgotLoading(false);
  };

  // ── Google OAuth ─────────────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      // Build the redirect URI that Supabase will send the user back to
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'nexusattendance',
        path: 'auth/callback',
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      });

      if (error || !data.url) {
        Alert.alert('Google Sign In Failed', error?.message ?? 'Could not start Google sign in.');
        setGoogleLoading(false);
        return;
      }

      // Open the Google consent screen in the system browser
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

      if (result.type === 'success' && result.url) {
        // Extract tokens from the callback URL
        const url = new URL(result.url);

        // Supabase returns tokens in the hash fragment
        const hashParams = new URLSearchParams(url.hash.replace('#', ''));
        const accessToken  = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (accessToken && refreshToken) {
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError || !sessionData.session) {
            Alert.alert('Sign In Failed', sessionError?.message ?? 'Could not establish session.');
          } else {
            // Check if profile exists, create one if not (first Google sign-in)
            const user = sessionData.session.user;
            const { data: profile } = await supabase
              .from('profiles')
              .select('id')
              .eq('id', user.id)
              .maybeSingle();

            if (!profile) {
              await supabase.from('profiles').insert({
                id: user.id,
                full_name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'User',
                role: 'student',
              });
            }

            router.replace('/(tabs)');
          }
        } else {
          Alert.alert('Sign In Failed', 'Could not retrieve authentication tokens.');
        }
      } else if (result.type === 'cancel') {
        // User closed the browser — silent
      } else {
        Alert.alert('Sign In Failed', 'Google sign in was not completed.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Google sign in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const showBiometric = biometricAvailable && Platform.OS !== 'web';
  const biometricIcon = biometricType === 'face' ? 'scan-outline' : 'finger-print';

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
                <TouchableOpacity
                  onPress={() => {
                    setForgotEmail(email); // pre-fill if they already typed email
                    setForgotVisible(true);
                  }}
                >
                  <Text style={s.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              </View>

              {/* Sign in + biometric */}
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
                  <TouchableOpacity
                    style={s.biometricBtn}
                    onPress={handleBiometricSignIn}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={biometricIcon} size={26} color={NexusColors.accentCyan} />
                  </TouchableOpacity>
                )}
              </View>

              {showBiometric && (
                <Text style={s.biometricHint}>
                  {biometricType === 'face' ? 'Tap 🔲 for Face ID' : 'Tap 👆 for fingerprint sign-in'}
                </Text>
              )}

              {/* Divider */}
              <View style={s.divider}>
                <View style={s.dividerLine} />
                <Text style={s.dividerText}>OR</Text>
                <View style={s.dividerLine} />
              </View>

              {/* Google */}
              <TouchableOpacity
                style={[s.googleBtn, googleLoading && { opacity: 0.7 }]}
                onPress={handleGoogleSignIn}
                disabled={googleLoading}
                activeOpacity={0.8}
              >
                {googleLoading ? (
                  <ActivityIndicator size="small" color={NexusColors.accentCyan} />
                ) : (
                  <>
                    <Text style={s.googleG}>G</Text>
                    <Text style={s.googleText}>Continue with Google</Text>
                  </>
                )}
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

        {/* ── Forgot Password Modal ── */}
        <Modal visible={forgotVisible} animationType="slide" transparent statusBarTranslucent>
          <View style={s.modalOverlay}>
            <View style={s.modalCard}>
              {forgotSent ? (
                /* Success state */
                <>
                  <View style={s.modalSuccessIcon}>
                    <Ionicons name="mail-open-outline" size={40} color={NexusColors.accentEmerald} />
                  </View>
                  <Text style={s.modalTitle}>Check your inbox</Text>
                  <Text style={s.modalSubtitle}>
                    We sent a password reset link to{'\n'}
                    <Text style={{ color: NexusColors.accentCyan }}>{forgotEmail.trim()}</Text>
                  </Text>
                  <Text style={s.modalNote}>
                    Didn't receive it? Check your spam folder or try again.
                  </Text>
                  <TouchableOpacity style={s.modalPrimaryBtn} onPress={closeForgotModal}>
                    <Text style={s.modalPrimaryBtnText}>Done</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.modalGhostBtn}
                    onPress={() => { setForgotSent(false); setForgotEmail(''); }}
                  >
                    <Text style={s.modalGhostBtnText}>Try a different email</Text>
                  </TouchableOpacity>
                </>
              ) : (
                /* Input state */
                <>
                  <View style={s.modalHeader}>
                    <Text style={s.modalTitle}>Reset password</Text>
                    <TouchableOpacity onPress={closeForgotModal} style={s.modalCloseBtn}>
                      <Ionicons name="close" size={22} color={NexusColors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <Text style={s.modalSubtitle}>
                    Enter your account email and we'll send you a reset link.
                  </Text>
                  <Text style={s.modalLabel}>EMAIL ADDRESS</Text>
                  <View style={s.modalInputRow}>
                    <Ionicons name="mail-outline" size={18} color={NexusColors.textSecondary} style={s.inputIcon} />
                    <TextInput
                      style={s.modalInput}
                      placeholder="you@university.edu"
                      placeholderTextColor={NexusColors.textDisabled}
                      value={forgotEmail}
                      onChangeText={setForgotEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoFocus
                    />
                  </View>
                  <TouchableOpacity
                    style={[s.modalPrimaryBtn, forgotLoading && { opacity: 0.6 }]}
                    onPress={handleForgotPassword}
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? (
                      <ActivityIndicator size="small" color={NexusColors.bgPrimary} />
                    ) : (
                      <Text style={s.modalPrimaryBtnText}>Send Reset Link</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={s.modalGhostBtn} onPress={closeForgotModal}>
                    <Text style={s.modalGhostBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </StardustTrail>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: NexusColors.bgPrimary },
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
  logoGlyph: { fontSize: 22, color: NexusColors.accentCyan },
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
    marginBottom: NexusSpacing.sm,
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
  biometricHint: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textDisabled,
    textAlign: 'center',
    marginBottom: NexusSpacing['2xl'],
    letterSpacing: NexusFonts.letterSpacing.wide,
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.md,
    marginBottom: NexusSpacing['2xl'],
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: NexusColors.borderGlass },
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
    minHeight: 52,
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

  // Forgot password modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: NexusColors.bgCardSolid,
    borderTopLeftRadius: NexusRadius['2xl'],
    borderTopRightRadius: NexusRadius['2xl'],
    borderWidth: 1,
    borderColor: NexusColors.borderGlass,
    padding: NexusSpacing['2xl'],
    paddingBottom: 48,
    gap: NexusSpacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalCloseBtn: { padding: NexusSpacing.xs },
  modalSuccessIcon: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderWidth: 1,
    borderColor: NexusColors.accentEmerald,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: NexusFonts.sizes.xl,
    fontWeight: NexusFonts.weights.extrabold,
    color: NexusColors.textPrimary,
  },
  modalSubtitle: {
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.textSecondary,
    lineHeight: 22,
  },
  modalNote: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textDisabled,
    lineHeight: 18,
  },
  modalLabel: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textSecondary,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
  modalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NexusColors.bgPrimary,
    borderRadius: NexusRadius.lg,
    borderWidth: 1,
    borderColor: NexusColors.borderGlass,
    paddingHorizontal: NexusSpacing.lg,
    paddingVertical: NexusSpacing.md,
  },
  modalInput: {
    flex: 1,
    fontSize: NexusFonts.sizes.base,
    color: NexusColors.textPrimary,
    fontWeight: NexusFonts.weights.medium,
  },
  modalPrimaryBtn: {
    backgroundColor: NexusColors.accentCyan,
    borderRadius: NexusRadius.lg,
    paddingVertical: NexusSpacing.lg,
    alignItems: 'center',
    shadowColor: NexusColors.accentCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
    minHeight: 52,
    justifyContent: 'center',
  },
  modalPrimaryBtnText: {
    fontSize: NexusFonts.sizes.md,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.bgPrimary,
  },
  modalGhostBtn: {
    borderRadius: NexusRadius.lg,
    paddingVertical: NexusSpacing.md,
    alignItems: 'center',
  },
  modalGhostBtnText: {
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.textSecondary,
    fontWeight: NexusFonts.weights.medium,
  },
});
