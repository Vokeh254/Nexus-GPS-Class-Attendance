/**
 * TimeWarpCard — Smart schedule prediction widget
 * Shows departure recommendation, auto-checkin prompt, and conflict resolver.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { NexusColors, NexusFonts, NexusSpacing, NexusRadius } from '@/constants/theme';

interface Session {
  className: string;
  courseCode: string;
  startedAt: string;   // ISO string
  roomDistance?: number; // metres
}

interface Props {
  nextSession: Session | null;
  isInsideGeofence: boolean;
  sessionActive: boolean;
  onMarkAttendance?: () => void;
}

function minutesUntil(isoString: string): number {
  return Math.round((new Date(isoString).getTime() - Date.now()) / 60000);
}

function getDepartureAdvice(minutesLeft: number, distanceM: number): string {
  const walkMinutes = Math.ceil(distanceM / 80); // ~80m/min walking pace
  const bufferMinutes = 5;
  const departIn = minutesLeft - walkMinutes - bufferMinutes;

  if (departIn <= 0) return 'Leave now to arrive on time';
  if (departIn <= 5) return `Leave in ${departIn} min for a comfortable arrival`;
  return `You have ${departIn} min before you need to leave`;
}

export default function TimeWarpCard({ nextSession, isInsideGeofence, sessionActive, onMarkAttendance }: Props) {
  const [now, setNow] = useState(Date.now());

  // Tick every 30s to keep countdown fresh
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  if (!nextSession) return null;

  const minsLeft = minutesUntil(nextSession.startedAt);
  const distance = nextSession.roomDistance ?? 200;
  const advice   = getDepartureAdvice(minsLeft, distance);
  const urgent   = minsLeft <= 10;

  const handleAutoCheckin = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onMarkAttendance?.();
  };

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Ionicons name="time-outline" size={14} color={NexusColors.accentIndigo} />
        <Text style={s.headerText}>TIMEWARP PREDICTION</Text>
      </View>

      {/* Session info */}
      <View style={s.sessionRow}>
        <View style={s.sessionInfo}>
          <Text style={s.sessionName}>{nextSession.className}</Text>
          <Text style={s.sessionCode}>{nextSession.courseCode}</Text>
        </View>
        <View style={[s.countdownBadge, urgent && s.countdownBadgeUrgent]}>
          <Text style={[s.countdownText, urgent && s.countdownTextUrgent]}>
            {minsLeft > 0 ? `${minsLeft}m` : 'NOW'}
          </Text>
        </View>
      </View>

      {/* Departure advice */}
      <View style={[s.adviceRow, urgent && s.adviceRowUrgent]}>
        <Ionicons
          name={urgent ? 'warning-outline' : 'navigate-outline'}
          size={14}
          color={urgent ? NexusColors.accentAmber : NexusColors.accentCyan}
        />
        <Text style={[s.adviceText, urgent && s.adviceTextUrgent]}>{advice}</Text>
      </View>

      {/* Auto-checkin prompt */}
      {isInsideGeofence && sessionActive && (
        <TouchableOpacity style={s.autoCheckinBtn} onPress={handleAutoCheckin} activeOpacity={0.85}>
          <Ionicons name="location" size={14} color={NexusColors.bgPrimary} />
          <Text style={s.autoCheckinText}>You're in the classroom — Mark attendance?</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    gap: NexusSpacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.xs,
  },
  headerText: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.black,
    color: NexusColors.textSecondary,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessionInfo: { flex: 1 },
  sessionName: {
    fontSize: NexusFonts.sizes.base,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textPrimary,
  },
  sessionCode: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.accentIndigo,
    fontWeight: NexusFonts.weights.semibold,
    marginTop: 2,
  },
  countdownBadge: {
    backgroundColor: 'rgba(99,102,241,0.15)',
    borderWidth: 1,
    borderColor: NexusColors.accentIndigo,
    borderRadius: NexusRadius.md,
    paddingHorizontal: NexusSpacing.md,
    paddingVertical: NexusSpacing.xs,
  },
  countdownBadgeUrgent: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderColor: NexusColors.accentAmber,
  },
  countdownText: {
    fontSize: NexusFonts.sizes.md,
    fontWeight: NexusFonts.weights.black,
    color: NexusColors.accentIndigo,
  },
  countdownTextUrgent: {
    color: NexusColors.accentAmber,
  },
  adviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.sm,
    backgroundColor: 'rgba(6,182,212,0.08)',
    borderRadius: NexusRadius.md,
    padding: NexusSpacing.md,
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.2)',
  },
  adviceRowUrgent: {
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderColor: 'rgba(245,158,11,0.25)',
  },
  adviceText: {
    flex: 1,
    fontSize: NexusFonts.sizes.sm,
    color: NexusColors.accentCyan,
    fontWeight: NexusFonts.weights.medium,
  },
  adviceTextUrgent: {
    color: NexusColors.accentAmber,
  },
  autoCheckinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.sm,
    backgroundColor: NexusColors.accentEmerald,
    borderRadius: NexusRadius.lg,
    paddingVertical: NexusSpacing.md,
    paddingHorizontal: NexusSpacing.lg,
    shadowColor: NexusColors.accentEmerald,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  autoCheckinText: {
    flex: 1,
    fontSize: NexusFonts.sizes.sm,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.bgPrimary,
  },
});
