import React, { useState } from 'react';
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
import { supabase } from '@/lib/supabase';
import { NexusColors, NexusFonts, NexusSpacing, NexusRadius } from '@/constants/theme';
import MagneticButton from '@/components/MagneticButton';
import StardustTrail from '@/components/StardustTrail';

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'student' | 'instructor'>('student');
  const [studentId, setStudentId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    if (!email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (signUpError) {
        Alert.alert('Registration Failed', signUpError.message);
        return;
      }
      if (!data.user) {
        Alert.alert('Registration Failed', 'Failed to create account. Please try again.');
        return;
      }

      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        full_name: fullName.trim(),
        role,
        student_id: role === 'student' ? (studentId.trim() || null) : null,
      });

      if (profileError) {
        Alert.alert('Profile Error', `Failed to create profile: ${profileError.message}`);
        return;
      }

      setSuccess(true);
    } catch (error: any) {
      Alert.alert('Error', `Something went wrong: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Success state ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor={NexusColors.bgPrimary} />
        <View style={s.successRoot}>
          <View style={s.successIconWrap}>
            <Ionicons name="checkmark-circle" size={64} color={NexusColors.accentEmerald} />
          </View>
          <Text style={s.successTitle}>Account Created!</Text>
          <Text style={s.successSub}>
            Check your email to verify your account, then sign in to get started.
          </Text>
          <TouchableOpacity style={s.successBtn} onPress={() => router.replace('/login')} activeOpacity={0.85}>
            <Text style={s.successBtnText}>Go to Sign In</Text>
            <Ionicons name="arrow-forward" size={18} color={NexusColors.bgPrimary} style={{ marginLeft: NexusSpacing.sm }} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Register form ──────────────────────────────────────────────────────────
  return (
    <StardustTrail>
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={NexusColors.bgPrimary} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.flex}>
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
          <Text style={s.headline}>Create your{'\n'}account.</Text>
          <Text style={s.subline}>Join your class and start tracking attendance.</Text>

          {/* Card */}
          <View style={s.card}>
            {/* Full name */}
            <Text style={s.label}>FULL NAME</Text>
            <View style={s.inputRow}>
              <Ionicons name="person-outline" size={18} color={NexusColors.textSecondary} style={s.inputIcon} />
              <TextInput
                style={s.input}
                placeholder="Your full name"
                placeholderTextColor={NexusColors.textDisabled}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            </View>

            {/* Email */}
            <Text style={[s.label, s.labelGap]}>EMAIL ADDRESS</Text>
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
            <Text style={[s.label, s.labelGap]}>PASSWORD</Text>
            <View style={s.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color={NexusColors.textSecondary} style={s.inputIcon} />
              <TextInput
                style={s.input}
                placeholder="Min. 6 characters"
                placeholderTextColor={NexusColors.textDisabled}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={s.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color={NexusColors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Confirm password */}
            <Text style={[s.label, s.labelGap]}>CONFIRM PASSWORD</Text>
            <View style={s.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color={NexusColors.textSecondary} style={s.inputIcon} />
              <TextInput
                style={s.input}
                placeholder="Repeat password"
                placeholderTextColor={NexusColors.textDisabled}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={s.eyeBtn}>
                <Ionicons name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color={NexusColors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Role selector */}
            <Text style={[s.label, s.labelGap]}>I AM A</Text>
            <View style={s.roleRow}>
              {(['student', 'instructor'] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[s.roleBtn, role === r && s.roleBtnActive]}
                  onPress={() => setRole(r)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={r === 'student' ? 'school-outline' : 'person-outline'}
                    size={18}
                    color={role === r ? NexusColors.bgPrimary : NexusColors.textSecondary}
                  />
                  <Text style={[s.roleBtnText, role === r && s.roleBtnTextActive]}>
                    {r === 'student' ? 'Student' : 'Instructor'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Student ID */}
            {role === 'student' && (
              <>
                <Text style={[s.label, s.labelGap]}>STUDENT ID (OPTIONAL)</Text>
                <View style={s.inputRow}>
                  <Ionicons name="card-outline" size={18} color={NexusColors.textSecondary} style={s.inputIcon} />
                  <TextInput
                    style={s.input}
                    placeholder="Institutional ID"
                    placeholderTextColor={NexusColors.textDisabled}
                    value={studentId}
                    onChangeText={setStudentId}
                    autoCapitalize="none"
                  />
                </View>
              </>
            )}

            {/* Submit */}
            <MagneticButton
              label={isLoading ? 'Creating Account…' : 'Create Account'}
              onPress={handleRegister}
              disabled={isLoading}
              loading={isLoading}
              icon="arrow-forward"
              fullWidth
              style={{ marginTop: NexusSpacing['2xl'], marginBottom: NexusSpacing['2xl'] }}
            />

            {/* Footer */}
            <Text style={s.footer}>
              Already have an account?{' '}
              <Text style={s.footerLink} onPress={() => router.replace('/login')}>
                Sign In
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
  labelGap: { marginTop: NexusSpacing.lg },
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

  // Role selector
  roleRow: {
    flexDirection: 'row',
    gap: NexusSpacing.md,
  },
  roleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: NexusSpacing.sm,
    paddingVertical: NexusSpacing.lg,
    borderRadius: NexusRadius.lg,
    borderWidth: 1,
    borderColor: NexusColors.borderGlass,
    backgroundColor: NexusColors.bgCardSolid,
  },
  roleBtnActive: {
    backgroundColor: NexusColors.accentCyan,
    borderColor: NexusColors.accentCyan,
  },
  roleBtnText: {
    fontSize: NexusFonts.sizes.base,
    fontWeight: NexusFonts.weights.semibold,
    color: NexusColors.textSecondary,
  },
  roleBtnTextActive: {
    color: NexusColors.bgPrimary,
  },

  // Submit
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NexusColors.accentCyan,
    borderRadius: NexusRadius.lg,
    paddingVertical: NexusSpacing.lg,
    marginTop: NexusSpacing['2xl'],
    marginBottom: NexusSpacing['2xl'],
    shadowColor: NexusColors.accentCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  btnDisabled: { opacity: 0.6 },
  submitBtnText: {
    fontSize: NexusFonts.sizes.md,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.bgPrimary,
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

  // Success
  successRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: NexusSpacing['3xl'],
  },
  successIconWrap: {
    width: 110,
    height: 110,
    borderRadius: NexusRadius.full,
    backgroundColor: NexusColors.bgCardSolid,
    borderWidth: 1,
    borderColor: NexusColors.accentEmerald,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: NexusSpacing['3xl'],
    shadowColor: NexusColors.accentEmerald,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6,
  },
  successTitle: {
    fontSize: NexusFonts.sizes['3xl'],
    fontWeight: NexusFonts.weights.black,
    color: NexusColors.textPrimary,
    marginBottom: NexusSpacing.md,
    textAlign: 'center',
  },
  successSub: {
    fontSize: NexusFonts.sizes.base,
    color: NexusColors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: NexusSpacing['3xl'],
  },
  successBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NexusColors.accentCyan,
    borderRadius: NexusRadius.lg,
    paddingVertical: NexusSpacing.lg,
    paddingHorizontal: NexusSpacing['3xl'],
    shadowColor: NexusColors.accentCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  successBtnText: {
    fontSize: NexusFonts.sizes.md,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.bgPrimary,
  },
});
