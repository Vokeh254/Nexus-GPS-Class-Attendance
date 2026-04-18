/**
 * ChronosReplay — Time-travel session debugger
 * Replays attendance flow as a timeline scrubber.
 * Instructors see the check-in wave; students see their arrival simulation.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { NexusColors, NexusFonts, NexusSpacing, NexusRadius } from '@/constants/theme';

interface CheckInEvent {
  time: string;   // "09:02"
  count: number;
  studentName?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  sessionName?: string;
  events?: CheckInEvent[];
  role?: 'student' | 'instructor';
}

const DEMO_EVENTS: CheckInEvent[] = [
  { time: '09:00', count: 3,  studentName: 'Alice Chen' },
  { time: '09:02', count: 8,  studentName: 'Bob Smith' },
  { time: '09:05', count: 15, studentName: 'Carol Davis' },
  { time: '09:10', count: 22, studentName: 'Dave Lee' },
  { time: '09:15', count: 31, studentName: 'Eve Wilson' },
  { time: '09:18', count: 35, studentName: 'Frank Brown' },
  { time: '09:22', count: 38, studentName: 'Grace Kim' },
  { time: '09:30', count: 40, studentName: 'Henry Park' },
];

export default function ChronosReplay({
  visible,
  onClose,
  sessionName = 'CS302 · Algorithms',
  events = DEMO_EVENTS,
  role = 'instructor',
}: Props) {
  const [playhead, setPlayhead] = useState(0);   // 0–(events.length-1)
  const [playing, setPlaying]   = useState(false);
  const playheadAnim = useRef(new Animated.Value(0)).current;
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // Scrubber bar width animation
  const scrubWidth = playheadAnim.interpolate({
    inputRange: [0, events.length - 1],
    outputRange: ['0%', '100%'],
  });

  useEffect(() => {
    Animated.timing(playheadAnim, {
      toValue: playhead,
      duration: 300,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [playhead]);

  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setPlayhead(prev => {
        if (prev >= events.length - 1) {
          setPlaying(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          return prev;
        }
        Haptics.selectionAsync().catch(() => {});
        return prev + 1;
      });
    }, 800);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, events.length]);

  const currentEvent = events[playhead];
  const maxCount = Math.max(...events.map(e => e.count), 1);

  const handlePlayPause = () => {
    if (playhead >= events.length - 1) {
      setPlayhead(0);
      setPlaying(true);
    } else {
      setPlaying(!playing);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={s.overlay}>
        <View style={s.sheet}>
          {/* Header */}
          <View style={s.header}>
            <View>
              <Text style={s.title}>CHRONOS</Text>
              <Text style={s.subtitle}>{sessionName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={22} color={NexusColors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Current snapshot */}
          <View style={s.snapshot}>
            <View style={s.snapshotLeft}>
              <Text style={s.snapshotTime}>{currentEvent?.time ?? '--:--'}</Text>
              <Text style={s.snapshotLabel}>
                {role === 'instructor' ? 'CHECK-IN WAVE' : 'YOUR ARRIVAL'}
              </Text>
            </View>
            <View style={s.snapshotRight}>
              <Text style={s.snapshotCount}>{currentEvent?.count ?? 0}</Text>
              <Text style={s.snapshotCountLabel}>students</Text>
            </View>
          </View>

          {/* Bar chart replay */}
          <View style={s.barChart}>
            {events.map((e, i) => (
              <TouchableOpacity
                key={i}
                style={s.barWrap}
                onPress={() => { setPlayhead(i); setPlaying(false); }}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    s.bar,
                    {
                      height: `${Math.round((e.count / maxCount) * 100)}%` as any,
                      backgroundColor: i <= playhead ? NexusColors.accentCyan : NexusColors.bgCard,
                      borderColor: i === playhead ? NexusColors.accentCyan : 'transparent',
                      borderWidth: i === playhead ? 1 : 0,
                      shadowColor: i === playhead ? NexusColors.accentCyan : 'transparent',
                      shadowOpacity: i === playhead ? 0.6 : 0,
                      shadowRadius: 4,
                      elevation: i === playhead ? 4 : 0,
                    },
                  ]}
                />
                <Text style={[s.barLabel, i === playhead && { color: NexusColors.accentCyan }]}>
                  {e.time.slice(3)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Scrubber */}
          <View style={s.scrubberTrack}>
            <Animated.View style={[s.scrubberFill, { width: scrubWidth }]} />
            <View style={[s.scrubberThumb, { left: `${(playhead / (events.length - 1)) * 100}%` as any }]} />
          </View>

          {/* Controls */}
          <View style={s.controls}>
            <TouchableOpacity
              style={s.controlBtn}
              onPress={() => { setPlayhead(0); setPlaying(false); }}
              activeOpacity={0.8}
            >
              <Ionicons name="play-skip-back" size={20} color={NexusColors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={s.playBtn} onPress={handlePlayPause} activeOpacity={0.85}>
              <Ionicons
                name={playing ? 'pause' : 'play'}
                size={28}
                color={NexusColors.bgPrimary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={s.controlBtn}
              onPress={() => { setPlayhead(events.length - 1); setPlaying(false); }}
              activeOpacity={0.8}
            >
              <Ionicons name="play-skip-forward" size={20} color={NexusColors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Event log */}
          <Text style={s.logLabel}>ATTENDANCE LOG</Text>
          <ScrollView style={s.logScroll} showsVerticalScrollIndicator={false}>
            {events.slice(0, playhead + 1).reverse().map((e, i) => (
              <View key={i} style={[s.logRow, i > 0 && s.logRowBorder]}>
                <View style={[s.logDot, { backgroundColor: i === 0 ? NexusColors.accentCyan : NexusColors.textDisabled }]} />
                <Text style={s.logTime}>{e.time}</Text>
                <Text style={s.logName}>
                  {role === 'instructor' ? `${e.count} students checked in` : (e.studentName ?? 'You checked in')}
                </Text>
              </View>
            ))}
          </ScrollView>
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
    maxHeight: '85%',
    gap: NexusSpacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: NexusFonts.sizes['2xl'],
    fontWeight: NexusFonts.weights.black,
    color: NexusColors.accentIndigo,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
  subtitle: {
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.textSecondary,
    marginTop: 2,
  },
  closeBtn: { padding: NexusSpacing.xs },
  // Snapshot
  snapshot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: NexusColors.bgCard,
    borderRadius: NexusRadius.lg,
    borderWidth: 1,
    borderColor: NexusColors.borderGlow,
    padding: NexusSpacing.lg,
  },
  snapshotLeft: {},
  snapshotTime: {
    fontSize: NexusFonts.sizes['2xl'],
    fontWeight: NexusFonts.weights.black,
    color: NexusColors.textPrimary,
  },
  snapshotLabel: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
    letterSpacing: NexusFonts.letterSpacing.widest,
    marginTop: 2,
  },
  snapshotRight: { alignItems: 'flex-end' },
  snapshotCount: {
    fontSize: NexusFonts.sizes['3xl'],
    fontWeight: NexusFonts.weights.black,
    color: NexusColors.accentCyan,
  },
  snapshotCountLabel: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
  },
  // Bar chart
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 80,
    gap: 4,
  },
  barWrap: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    gap: 3,
  },
  bar: {
    width: '100%',
    borderRadius: 3,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 8,
    color: NexusColors.textDisabled,
    fontWeight: NexusFonts.weights.bold,
  },
  // Scrubber
  scrubberTrack: {
    height: 4,
    backgroundColor: NexusColors.borderGlass,
    borderRadius: NexusRadius.full,
    position: 'relative',
    marginVertical: NexusSpacing.xs,
  },
  scrubberFill: {
    height: 4,
    backgroundColor: NexusColors.accentCyan,
    borderRadius: NexusRadius.full,
  },
  scrubberThumb: {
    position: 'absolute',
    top: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: NexusColors.accentCyan,
    marginLeft: -8,
    shadowColor: NexusColors.accentCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  // Controls
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: NexusSpacing['2xl'],
  },
  controlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: NexusColors.bgCard,
    borderWidth: 1,
    borderColor: NexusColors.borderGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: NexusColors.accentCyan,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: NexusColors.accentCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  // Log
  logLabel: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textDisabled,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
  logScroll: { maxHeight: 140 },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.md,
    paddingVertical: NexusSpacing.sm,
  },
  logRowBorder: {
    borderTopWidth: 1,
    borderTopColor: NexusColors.borderGlass,
  },
  logDot: {
    width: 8, height: 8, borderRadius: 4,
  },
  logTime: {
    fontSize: NexusFonts.sizes.sm,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textSecondary,
    minWidth: 40,
  },
  logName: {
    flex: 1,
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.textPrimary,
    fontWeight: NexusFonts.weights.medium,
  },
});
