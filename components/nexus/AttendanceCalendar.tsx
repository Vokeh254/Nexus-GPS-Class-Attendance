/**
 * AttendanceCalendar — monthly calendar showing attendance status per day
 *
 * Colors:
 *   🟢 Emerald  — attended (present)
 *   🔴 Rose     — session existed but student was absent
 *   ⬜ Dim      — no session scheduled
 *   🔵 Cyan     — today
 */

import React, { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { NexusColors, NexusFonts, NexusSpacing, NexusRadius } from '@/constants/theme'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DayStatus = 'present' | 'absent' | 'none'

export interface CalendarDay {
  date: string   // YYYY-MM-DD
  status: DayStatus
}

interface Props {
  days: CalendarDay[]          // all days with known status
  initialYear?: number
  initialMonth?: number        // 0-indexed
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function firstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

function toYMD(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AttendanceCalendar({ days, initialYear, initialMonth }: Props) {
  const today = new Date()
  const [year, setYear]   = useState(initialYear  ?? today.getFullYear())
  const [month, setMonth] = useState(initialMonth ?? today.getMonth())

  const statusMap = new Map(days.map(d => [d.date, d.status]))

  const totalDays  = daysInMonth(year, month)
  const startDay   = firstDayOfMonth(year, month)
  const todayStr   = toYMD(today.getFullYear(), today.getMonth(), today.getDate())

  // Build grid cells: leading blanks + day cells
  const cells: Array<{ day: number | null; date: string | null }> = []
  for (let i = 0; i < startDay; i++) cells.push({ day: null, date: null })
  for (let d = 1; d <= totalDays; d++) {
    cells.push({ day: d, date: toYMD(year, month, d) })
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  // Legend counts for this month
  let presentCount = 0, absentCount = 0
  for (let d = 1; d <= totalDays; d++) {
    const s = statusMap.get(toYMD(year, month, d))
    if (s === 'present') presentCount++
    else if (s === 'absent') absentCount++
  }

  return (
    <View style={s.root}>
      {/* Month navigation */}
      <View style={s.navRow}>
        <TouchableOpacity onPress={prevMonth} style={s.navBtn}>
          <Ionicons name="chevron-back" size={18} color={NexusColors.accentCyan} />
        </TouchableOpacity>
        <Text style={s.monthLabel}>{MONTHS[month]} {year}</Text>
        <TouchableOpacity onPress={nextMonth} style={s.navBtn}>
          <Ionicons name="chevron-forward" size={18} color={NexusColors.accentCyan} />
        </TouchableOpacity>
      </View>

      {/* Weekday headers */}
      <View style={s.weekRow}>
        {WEEKDAYS.map(w => (
          <Text key={w} style={s.weekDay}>{w}</Text>
        ))}
      </View>

      {/* Day grid */}
      <View style={s.grid}>
        {cells.map((cell, idx) => {
          if (!cell.day || !cell.date) {
            return <View key={`blank-${idx}`} style={s.cell} />
          }
          const status  = statusMap.get(cell.date) ?? 'none'
          const isToday = cell.date === todayStr

          return (
            <View
              key={cell.date}
              style={[
                s.cell,
                status === 'present' && s.cellPresent,
                status === 'absent'  && s.cellAbsent,
                isToday              && s.cellToday,
              ]}
            >
              <Text style={[
                s.cellText,
                status === 'present' && s.cellTextPresent,
                status === 'absent'  && s.cellTextAbsent,
                isToday              && s.cellTextToday,
              ]}>
                {cell.day}
              </Text>
            </View>
          )
        })}
      </View>

      {/* Legend */}
      <View style={s.legend}>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: NexusColors.accentEmerald }]} />
          <Text style={s.legendText}>Present ({presentCount})</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: NexusColors.accentRose }]} />
          <Text style={s.legendText}>Absent ({absentCount})</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: NexusColors.accentCyan }]} />
          <Text style={s.legendText}>Today</Text>
        </View>
      </View>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const CELL_SIZE = 38

const s = StyleSheet.create({
  root: { paddingBottom: NexusSpacing.sm },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: NexusSpacing.md,
  },
  navBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: NexusColors.bgCardSolid,
    alignItems: 'center', justifyContent: 'center',
  },
  monthLabel: {
    fontSize: NexusFonts.sizes.base,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textPrimary,
    letterSpacing: 0.5,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: NexusSpacing.xs,
  },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: NexusFonts.weights.bold,
    color: NexusColors.textSecondary,
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%` as any,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  cellPresent: {
    backgroundColor: `${NexusColors.accentEmerald}30`,
    borderRadius: NexusRadius.sm,
    borderWidth: 1,
    borderColor: NexusColors.accentEmerald,
  },
  cellAbsent: {
    backgroundColor: `${NexusColors.accentRose}25`,
    borderRadius: NexusRadius.sm,
    borderWidth: 1,
    borderColor: NexusColors.accentRose,
  },
  cellToday: {
    backgroundColor: `${NexusColors.accentCyan}30`,
    borderRadius: NexusRadius.sm,
    borderWidth: 1.5,
    borderColor: NexusColors.accentCyan,
  },
  cellText: {
    fontSize: 12,
    color: NexusColors.textSecondary,
    fontWeight: NexusFonts.weights.medium,
  },
  cellTextPresent: { color: NexusColors.accentEmerald, fontWeight: NexusFonts.weights.bold },
  cellTextAbsent:  { color: NexusColors.accentRose,    fontWeight: NexusFonts.weights.bold },
  cellTextToday:   { color: NexusColors.accentCyan,    fontWeight: NexusFonts.weights.bold },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: NexusSpacing.lg,
    marginTop: NexusSpacing.md,
    flexWrap: 'wrap',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: NexusColors.textSecondary },
})
