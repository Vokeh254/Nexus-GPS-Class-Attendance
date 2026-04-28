/**
 * SessionScheduler — polls every 60 seconds and auto-activates class_sessions
 * whose scheduled_start has been reached but is_active is still false.
 *
 * Also auto-closes sessions that have been active for more than 2 hours
 * (configurable via SESSION_DURATION_MS).
 *
 * Usage:
 *   SessionScheduler.start()   — call once after instructor logs in
 *   SessionScheduler.stop()    — call on sign-out / unmount
 */

import { supabase } from '../lib/supabase'

const POLL_INTERVAL_MS = 60_000        // check every 60 s
const SESSION_DURATION_MS = 2 * 60 * 60 * 1000  // auto-close after 2 h

let _timer: ReturnType<typeof setInterval> | null = null

async function tick() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const now = new Date().toISOString()

  // ── 1. Auto-start: sessions whose scheduled_start ≤ now and not yet active ──
  const { data: toStart } = await supabase
    .from('class_sessions')
    .select('id, class_id')
    .eq('instructor_id', user.id)
    .eq('is_active', false)
    .lte('scheduled_start', now)
    .is('ended_at', null)

  if (toStart && toStart.length > 0) {
    for (const session of toStart) {
      await supabase
        .from('class_sessions')
        .update({ is_active: true, started_at: now })
        .eq('id', session.id)
    }
  }

  // ── 2. Auto-close: sessions active for > SESSION_DURATION_MS ──────────────
  const cutoff = new Date(Date.now() - SESSION_DURATION_MS).toISOString()

  const { data: toClose } = await supabase
    .from('class_sessions')
    .select('id')
    .eq('instructor_id', user.id)
    .eq('is_active', true)
    .lte('started_at', cutoff)

  if (toClose && toClose.length > 0) {
    for (const session of toClose) {
      await supabase
        .from('class_sessions')
        .update({ is_active: false, ended_at: now })
        .eq('id', session.id)
    }
  }
}

export const SessionScheduler = {
  start() {
    if (_timer) return
    // Run immediately, then on interval
    tick()
    _timer = setInterval(tick, POLL_INTERVAL_MS)
  },

  stop() {
    if (_timer) {
      clearInterval(_timer)
      _timer = null
    }
  },

  /** Force an immediate check (e.g. after creating a new session) */
  async checkNow() {
    await tick()
  },
}
