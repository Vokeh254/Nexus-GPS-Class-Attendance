/**
 * NotificationService — schedules local push notifications for class reminders.
 * Uses expo-notifications to fire at 10 min and 15 min before a session.
 * The 15-min reminder earns Nexus Coins when attendance is marked on time.
 */

import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export type ReminderType = '15min' | '10min'

export interface ScheduledReminder {
  classId: string
  sessionId: string
  type: ReminderType
  notificationId: string
}

class NotificationService {
  async requestPermissions(): Promise<boolean> {
    // Notifications only work on physical devices (not web)
    if (Platform.OS === 'web') return false

    const { status: existing } = await Notifications.getPermissionsAsync()
    if (existing === 'granted') return true

    const { status } = await Notifications.requestPermissionsAsync()
    if (status !== 'granted') return false

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('class-reminders', {
        name: 'Class Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#06B6D4',
      })
    }

    return true
  }

  /**
   * Schedule both a 15-min and 10-min reminder for a session.
   * Returns the notification IDs so they can be cancelled later.
   */
  async scheduleClassReminders(params: {
    classId: string
    sessionId: string
    className: string
    courseCode: string
    scheduledAt: Date
  }): Promise<{ id15min: string | null; id10min: string | null }> {
    const granted = await this.requestPermissions()
    if (!granted) return { id15min: null, id10min: null }

    const now = Date.now()
    const sessionMs = params.scheduledAt.getTime()

    const fire15 = new Date(sessionMs - 15 * 60 * 1000)
    const fire10 = new Date(sessionMs - 10 * 60 * 1000)

    let id15min: string | null = null
    let id10min: string | null = null

    if (fire15.getTime() > now) {
      id15min = await Notifications.scheduleNotificationAsync({
        content: {
          title: `⏰ ${params.courseCode} in 15 minutes`,
          body: `${params.className} is starting soon. Mark early for Nexus Coins! 🪙`,
          data: { classId: params.classId, sessionId: params.sessionId, type: '15min' },
          sound: true,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fire15 },
      })
    }

    if (fire10.getTime() > now) {
      id10min = await Notifications.scheduleNotificationAsync({
        content: {
          title: `🔔 ${params.courseCode} in 10 minutes`,
          body: `${params.className} starts in 10 min. Head to class now!`,
          data: { classId: params.classId, sessionId: params.sessionId, type: '10min' },
          sound: true,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fire10 },
      })
    }

    return { id15min, id10min }
  }

  async cancelReminders(notificationIds: (string | null)[]) {
    for (const id of notificationIds) {
      if (id) await Notifications.cancelScheduledNotificationAsync(id)
    }
  }

  async cancelAllReminders() {
    await Notifications.cancelAllScheduledNotificationsAsync()
  }

  /** Returns all currently scheduled notification IDs */
  async getScheduledReminders(): Promise<string[]> {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync()
    return scheduled.map((n) => n.identifier)
  }
}

export default new NotificationService()
