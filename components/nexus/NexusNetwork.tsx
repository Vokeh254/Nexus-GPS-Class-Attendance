/**
 * NexusNetwork — Offline-first attendance + QR backup
 * Shows offline queue status, sync progress, and QR code fallback.
 * Real offline sync wires in via AsyncStorage + Supabase retry queue.
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

interface QueuedRecord {
  id: string;
  classId: string;
  className: string;
  timestamp: string;
  synced: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  studentId?: string;
  studentName?: string;
  isOnline?: boolean;
}

// Simulated QR pattern using View grid (real QR via expo-barcode-scanner or react-native-qrcode-svg)
function QRPlaceholder({ value }: { value: string }) {
  // 7×7 finder pattern approximation
  const PATTERN = [
    [1,1,1,1,1,1,1,0,0,0,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,1],
    [1,0,1,1,1,0,1,0,1,0,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,0,0,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,1,0,1,0,1,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,0,1,0,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],
    [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1],
    [0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],
    [0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0],
    [1,1,1,1,1,1,1,0,0,0,1,0,1,0,1,0,1],
    [1,0,0,0,0,0,1,0,1,0,0,1,0,1,0,1,0],
    [1,0,1,1,1,0,1,0,0,0,1,0,1,0,1,0,1],
    [1,0,1,1,1,0,1,0,1,0,0,1,0,1,0,1,0],
    [1,0,0,0,0,0,1,0,0,0,1,0,1,0,1,0,1],
    [1,1,1,1,1,1,1,0,1,0,0,1,0,1,0,1,0],
  ];

  const CELL = 14;
  return (
    <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: NexusRadius.md }}>
      {PATTERN.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row' }}>
          {row.map((cell, ci) => (
            <View
              key={ci}
              style={{
                width: CELL,
                height: CELL,
                backgroundColor: cell ? '#0B1120' : '#fff',
              }}
            />
          ))}
        </View>
      ))}
      <Text style={{ textAlign: 'center', fontSize: 8, color: '#475569', marginTop: 6, letterSpacing: 1 }}>
        {value.slice(0, 24)}
      </Text>
    </View>
  );
}

export default function NexusNetwork({
  visible,
  onClose,
  studentId = 'STU-2024-001',
  studentName = 'Student',
  isOnline = true,
}: Props) {
  const [queue] = useState<QueuedRecord[]>([
    { id: '1', classId: 'cs302', className: 'CS302 · Algorithms',      timestamp: '09:02 AM', synced: true  },
    { id: '2', classId: 'ma201', className: 'MA201 · Calculus II',      timestamp: '11:15 AM', synced: true  },
    { id: '3', classId: 'cs401', className: 'CS401 · Mobile Dev',       timestamp: '02:30 PM', synced: false },
  ]);
  const [syncing, setSyncing] = useState(false);
  const [showQR, setShowQR]   = useState(false);

  const syncProgress = useRef(new Animated.Value(0)).current;
  const signalPulse  = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(signalPulse, { toValue: 1,   duration: 800, useNativeDriver: true }),
        Animated.timing(signalPulse, { toValue: 0.5, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handleSync = () => {
    if (syncing) return;
    setSyncing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    syncProgress.setValue(0);
    Animated.timing(syncProgress, {
      toValue: 1,
      duration: 2000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      setSyncing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    });
  };

  const syncWidth = syncProgress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const pending   = queue.filter(r => !r.synced).length;
  const qrValue   = `nexus://checkin?student=${studentId}&name=${encodeURIComponent(studentName)}&ts=${Date.now()}`;

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={s.overlay}>
        <View style={s.sheet}>
          {/* Header */}
          <View style={s.header}>
            <View>
              <Text style={s.title}>NEXUS NETWORK</Text>
              <Text style={s.subtitle}>Offline-First Attendance</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={22} color={NexusColors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Connection status */}
          <View style={[s.statusCard, { borderColor: isOnline ? NexusColors.accentEmerald : NexusColors.accentAmber }]}>
            <Animated.View style={[s.statusDot, {
              backgroundColor: isOnline ? NexusColors.accentEmerald : NexusColors.accentAmber,
              opacity: signalPulse,
            }]} />
            <View style={s.statusText}>
              <Text style={[s.statusTitle, { color: isOnline ? NexusColors.accentEmerald : NexusColors.accentAmber }]}>
                {isOnline ? 'CONNECTED' : 'OFFLINE MODE'}
              </Text>
              <Text style={s.statusSub}>
                {isOnline
                  ? 'All records syncing in real-time'
                  : `${pending} record${pending !== 1 ? 's' : ''} queued for sync`}
              </Text>
            </View>
            <Ionicons
              name={isOnline ? 'wifi' : 'wifi-outline'}
              size={22}
              color={isOnline ? NexusColors.accentEmerald : NexusColors.accentAmber}
            />
          </View>

          {/* Sync progress */}
          {pending > 0 && (
            <View style={s.syncSection}>
              <View style={s.syncHeader}>
                <Text style={s.syncLabel}>{pending} PENDING SYNC{pending !== 1 ? 'S' : ''}</Text>
                <TouchableOpacity
                  style={[s.syncBtn, syncing && s.syncBtnDisabled]}
                  onPress={handleSync}
                  disabled={syncing}
                  activeOpacity={0.8}
                >
                  <Ionicons name="sync-outline" size={14} color={NexusColors.bgPrimary} />
                  <Text style={s.syncBtnText}>{syncing ? 'Syncing...' : 'Sync Now'}</Text>
                </TouchableOpacity>
              </View>
              <View style={s.syncTrack}>
                <Animated.View style={[s.syncFill, { width: syncWidth }]} />
              </View>
            </View>
          )}

          {/* Queue list */}
          <Text style={s.queueLabel}>ATTENDANCE QUEUE</Text>
          <View style={s.queueList}>
            {queue.map((record, i) => (
              <View key={record.id} style={[s.queueRow, i < queue.length - 1 && s.queueRowBorder]}>
                <View style={[s.queueDot, { backgroundColor: record.synced ? NexusColors.accentEmerald : NexusColors.accentAmber }]} />
                <View style={s.queueInfo}>
                  <Text style={s.queueClass}>{record.className}</Text>
                  <Text style={s.queueTime}>{record.timestamp}</Text>
                </View>
                <View style={[s.queueBadge, { borderColor: record.synced ? NexusColors.accentEmerald : NexusColors.accentAmber }]}>
                  <Text style={[s.queueBadgeText, { color: record.synced ? NexusColors.accentEmerald : NexusColors.accentAmber }]}>
                    {record.synced ? 'SYNCED' : 'PENDING'}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* QR backup */}
          <TouchableOpacity
            style={s.qrToggleBtn}
            onPress={() => {
              setShowQR(!showQR);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="qr-code-outline" size={18} color={NexusColors.accentCyan} />
            <Text style={s.qrToggleText}>
              {showQR ? 'Hide QR Backup' : 'Show QR Backup Code'}
            </Text>
            <Ionicons
              name={showQR ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={NexusColors.textSecondary}
            />
          </TouchableOpacity>

          {showQR && (
            <View style={s.qrSection}>
              <Text style={s.qrHint}>
                Show this to your instructor if GPS check-in fails
              </Text>
              <View style={s.qrWrap}>
                <QRPlaceholder value={qrValue} />
              </View>
              <Text style={s.qrId}>{studentId}</Text>
            </View>
          )}
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
  title: {
    fontSize: NexusFonts.sizes['2xl'],
    fontWeight: NexusFonts.weights.black,
    color: NexusColors.accentEmerald,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
  subtitle: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
    letterSpacing: NexusFonts.letterSpacing.wide,
    marginTop: 2,
  },
  closeBtn: { padding: NexusSpacing.xs },
  // Status
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.md,
    backgroundColor: NexusColors.bgCard,
    borderRadius: NexusRadius.lg,
    borderWidth: 1,
    padding: NexusSpacing.lg,
  },
  statusDot: {
    width: 10, height: 10, borderRadius: 5,
  },
  statusText: { flex: 1 },
  statusTitle: {
    fontSize: NexusFonts.sizes.sm,
    fontWeight: NexusFonts.weights.black,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
  statusSub: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
    marginTop: 2,
  },
  // Sync
  syncSection: { gap: NexusSpacing.sm },
  syncHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  syncLabel: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textSecondary,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.xs,
    backgroundColor: NexusColors.accentCyan,
    borderRadius: NexusRadius.full,
    paddingHorizontal: NexusSpacing.md,
    paddingVertical: NexusSpacing.xs,
  },
  syncBtnDisabled: { opacity: 0.5 },
  syncBtnText: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.bgPrimary,
  },
  syncTrack: {
    height: 4,
    backgroundColor: NexusColors.borderGlass,
    borderRadius: NexusRadius.full,
    overflow: 'hidden',
  },
  syncFill: {
    height: 4,
    backgroundColor: NexusColors.accentCyan,
    borderRadius: NexusRadius.full,
  },
  // Queue
  queueLabel: {
    fontSize: NexusFonts.sizes.xs,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textDisabled,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
  queueList: {
    backgroundColor: NexusColors.bgCard,
    borderRadius: NexusRadius.lg,
    borderWidth: 1,
    borderColor: NexusColors.borderGlass,
    paddingHorizontal: NexusSpacing.lg,
  },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.md,
    paddingVertical: NexusSpacing.md,
  },
  queueRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: NexusColors.borderGlass,
  },
  queueDot: { width: 8, height: 8, borderRadius: 4 },
  queueInfo: { flex: 1 },
  queueClass: {
    fontSize: NexusFonts.sizes.sm,
    fontWeight: NexusFonts.weights.semibold,
    color: NexusColors.textPrimary,
  },
  queueTime: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
    marginTop: 2,
  },
  queueBadge: {
    borderWidth: 1,
    borderRadius: NexusRadius.sm,
    paddingHorizontal: NexusSpacing.sm,
    paddingVertical: 2,
  },
  queueBadgeText: {
    fontSize: 9,
    fontWeight: NexusFonts.weights.black,
    letterSpacing: NexusFonts.letterSpacing.widest,
  },
  // QR
  qrToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NexusSpacing.sm,
    backgroundColor: NexusColors.bgCard,
    borderRadius: NexusRadius.lg,
    borderWidth: 1,
    borderColor: NexusColors.borderGlow,
    padding: NexusSpacing.lg,
  },
  qrToggleText: {
    flex: 1,
    fontSize: NexusFonts.sizes.sm,
    fontWeight: NexusFonts.weights.semibold,
    color: NexusColors.accentCyan,
  },
  qrSection: {
    alignItems: 'center',
    gap: NexusSpacing.md,
  },
  qrHint: {
    fontSize: NexusFonts.sizes.xs,
    color: NexusColors.textSecondary,
    textAlign: 'center',
    letterSpacing: NexusFonts.letterSpacing.wide,
  },
  qrWrap: {
    shadowColor: NexusColors.accentCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  qrId: {
    fontSize: NexusFonts.sizes.sm,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textSecondary,
    letterSpacing: NexusFonts.letterSpacing.wider,
  },
});
