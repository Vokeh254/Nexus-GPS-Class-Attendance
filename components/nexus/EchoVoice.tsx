/**
 * EchoVoice — Voice command interface
 * Renders a floating mic button with waveform animation.
 * Parses spoken commands and routes to app actions.
 * Real speech recognition wires in via expo-speech / @react-native-voice/voice.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { NexusColors, NexusFonts, NexusSpacing, NexusRadius } from '@/constants/theme';

interface Command {
  pattern: RegExp;
  label: string;
  action: () => void;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onMarkAttendance?: () => void;
  onNavigateRadar?: () => void;
  onNavigateAnalytics?: () => void;
}

const DEMO_RESPONSES: Record<string, string> = {
  'mark':       '✅ Navigating to attendance check-in...',
  'attendance': '✅ Navigating to attendance check-in...',
  'radar':      '📡 Opening Radar screen...',
  'class':      '🎓 Your next class is CS302 · Algorithms at 10:30 AM in Room 402.',
  'analytics':  '📊 Opening Analytics...',
  'streak':     '🔥 Your current streak is 12 days. Keep it up!',
  'coins':      '🪙 You have 185 NXS coins. Spend them in the wallet.',
  'help':       '💡 Try: "mark attendance", "where is my class", "show analytics", "my streak"',
};

function matchCommand(text: string): string {
  const lower = text.toLowerCase();
  for (const [key, response] of Object.entries(DEMO_RESPONSES)) {
    if (lower.includes(key)) return response;
  }
  return `🤔 I heard "${text}" — try "help" for available commands.`;
}

// Waveform bar heights (simulated)
const BAR_COUNT = 20;

export default function EchoVoice({ visible, onClose, onMarkAttendance, onNavigateRadar, onNavigateAnalytics }: Props) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [lastCommands] = useState([
    'Where is my next class?',
    'Show my streak',
    'Mark attendance',
  ]);

  // Waveform bars
  const bars = useRef(Array.from({ length: BAR_COUNT }, () => new Animated.Value(0.2))).current;
  const micPulse = useRef(new Animated.Value(1)).current;
  const micGlow  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!listening) {
      bars.forEach(b => Animated.timing(b, { toValue: 0.2, duration: 200, useNativeDriver: true }).start());
      Animated.timing(micGlow, { toValue: 0, duration: 300, useNativeDriver: true }).start();
      return;
    }

    // Animate waveform
    const animations = bars.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 40),
          Animated.timing(b, { toValue: 0.3 + Math.random() * 0.7, duration: 200 + Math.random() * 200, useNativeDriver: true }),
          Animated.timing(b, { toValue: 0.2, duration: 200, useNativeDriver: true }),
        ])
      )
    );
    animations.forEach(a => a.start());

    Animated.loop(
      Animated.sequence([
        Animated.timing(micPulse, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(micPulse, { toValue: 1,    duration: 600, useNativeDriver: true }),
      ])
    ).start();

    Animated.timing(micGlow, { toValue: 1, duration: 300, useNativeDriver: true }).start();

    return () => animations.forEach(a => a.stop());
  }, [listening]);

  const handleMicPress = () => {
    if (listening) {
      // Stop — simulate a recognized command
      setListening(false);
      const demo = lastCommands[Math.floor(Math.random() * lastCommands.length)];
      setTranscript(demo);
      setResponse(matchCommand(demo));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      // Route action
      if (demo.toLowerCase().includes('mark') || demo.toLowerCase().includes('attendance')) {
        setTimeout(() => { onMarkAttendance?.(); onClose(); }, 1200);
      } else if (demo.toLowerCase().includes('radar')) {
        setTimeout(() => { onNavigateRadar?.(); onClose(); }, 1200);
      } else if (demo.toLowerCase().includes('analytics')) {
        setTimeout(() => { onNavigateAnalytics?.(); onClose(); }, 1200);
      }
    } else {
      setListening(true);
      setTranscript('');
      setResponse('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={s.overlay}>
        <View style={s.sheet}>
          {/* Header */}
          <View style={s.header}>
            <View style={s.headerLeft}>
              <Text style={s.title}>ECHO</Text>
              <Text style={s.subtitle}>Voice Command Interface</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={22} color={NexusColors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Waveform */}
          <View style={s.waveform}>
            {bars.map((b, i) => (
              <Animated.View
                key={i}
                style={[
                  s.bar,
                  {
                    transform: [{ scaleY: b }],
                    backgroundColor: listening ? NexusColors.accentCyan : NexusColors.textDisabled,
                  },
                ]}
              />
            ))}
          </View>

          {/* Mic button */}
          <View style={s.micWrap}>
            <Animated.View style={[s.micGlowRing, { opacity: micGlow }]} />
            <TouchableOpacity
              style={[s.micBtn, listening && s.micBtnActive]}
              onPress={handleMicPress}
              activeOpacity={0.85}
            >
              <Animated.View style={{ transform: [{ scale: micPulse }] }}>
                <Ionicons
                  name={listening ? 'mic' : 'mic-outline'}
                  size={36}
                  color={listening ? NexusColors.bgPrimary : NexusColors.accentCyan}
                />
              </Animated.View>
            </TouchableOpacity>
          </View>

          <Text style={s.micHint}>
            {listening ? 'Listening... tap to stop' : 'Tap to speak'}
          </Text>

          {/* Transcript + response */}
          {transcript !== '' && (
            <View style={s.transcriptCard}>
              <Text style={s.transcriptLabel}>YOU SAID</Text>
              <Text style={s.transcriptText}>"{transcript}"</Text>
              {response !== '' && (
                <>
                  <View style={s.responseDivider} />
                  <Text style={s.responseText}>{response}</Text>
                </>
              )}
            </View>
          )}

          {/* Suggested commands */}
          <Text style={s.suggestLabel}>TRY SAYING</Text>
          <View style={s.suggestions}>
            {[
              'Where is my next class?',
              'Mark attendance',
              'Show my streak',
              'My Nexus coins',
            ].map((cmd) => (
              <TouchableOpacity
                key={cmd}
                style={s.suggestionChip}
                onPress={() => {
                  setTranscript(cmd);
                  setResponse(matchCommand(cmd));
                  Haptics.selectionAsync().catch(() => {});
                }}
                activeOpacity={0.8}
              >
                <Text style={s.suggestionText}>{cmd}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: NexusColors.bgCardSolid,
    borderTopLeftRadius: NexusRadius['2xl'],
    borderTopRightRadius: NexusRadius['2xl'],
    borderWidth: 1,
    borderColor: NexusColors.borderGlass,
    padding: NexusSpacing['2xl'],
    paddingBottom: 48,
    gap: NexusSpacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerLeft: {},
  title: {
    fontSize: NexusFonts.sizes['2xl'],
    fontWeight: NexusFonts.weights.black,
    color: NexusColors.accentCyan,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
  subtitle: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
    letterSpacing: NexusFonts.letterSpacing.wide,
  },
  closeBtn: { padding: NexusSpacing.xs },
  // Waveform
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    gap: 3,
  },
  bar: {
    width: 3,
    height: 40,
    borderRadius: 2,
  },
  // Mic
  micWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 100,
  },
  micGlowRing: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: NexusColors.accentCyan,
    opacity: 0.15,
    shadowColor: NexusColors.accentCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 8,
  },
  micBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: NexusColors.bgCard,
    borderWidth: 2,
    borderColor: NexusColors.borderGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: {
    backgroundColor: NexusColors.accentCyan,
    borderColor: NexusColors.accentCyan,
  },
  micHint: {
    textAlign: 'center',
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.textSecondary,
    letterSpacing: NexusFonts.letterSpacing.wide,
    marginTop: -NexusSpacing.sm,
  },
  // Transcript
  transcriptCard: {
    backgroundColor: NexusColors.bgCard,
    borderRadius: NexusRadius.lg,
    borderWidth: 1,
    borderColor: NexusColors.borderGlass,
    padding: NexusSpacing.lg,
    gap: NexusSpacing.sm,
  },
  transcriptLabel: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textDisabled,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
  transcriptText: {
    fontSize: NexusFonts.sizes.base,
    fontWeight: NexusFonts.weights.semibold,
    color: NexusColors.textPrimary,
    fontStyle: 'italic',
  },
  responseDivider: {
    height: 1,
    backgroundColor: NexusColors.borderGlass,
  },
  responseText: {
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.accentCyan,
    fontWeight: NexusFonts.weights.medium,
  },
  // Suggestions
  suggestLabel: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textDisabled,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: NexusSpacing.sm,
  },
  suggestionChip: {
    backgroundColor: NexusColors.bgCard,
    borderRadius: NexusRadius.full,
    borderWidth: 1,
    borderColor: NexusColors.borderGlass,
    paddingHorizontal: NexusSpacing.lg,
    paddingVertical: NexusSpacing.sm,
  },
  suggestionText: {
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.textSecondary,
    fontWeight: NexusFonts.weights.medium,
  },
});
