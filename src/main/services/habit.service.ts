/**
 * 习惯领域服务：习惯的增删改查与每日打卡（habit_logs 表按「习惯 + 日期」唯一）。
 */
import { getDb } from '../db/database'
import type { Habit, HabitInput, HabitWithProgress } from '@shared/types'

function mapHabit(row: Record<string, unknown>): Habit {
  return {
    id: Number(row.id),
    name: String(row.name),
    icon: String(row.icon ?? '✅'),
    target: Number(row.target ?? 1),
    sortOrder: Number(row.sort_order ?? 0),
    archived: Number(row.archived) === 1
  }
}

export const habitService = {
  /** 指定日期的习惯列表（含打卡进度） */
  list(date: string): HabitWithProgress[] {
    const rows = getDb()
      .prepare(
        `SELECT h.*, COALESCE(l.count, 0) AS check_count
         FROM habits h
         LEFT JOIN habit_logs l ON l.habit_id = h.id AND l.date = ?
         WHERE h.archived = 0
         ORDER BY h.sort_order ASC, h.id ASC`
      )
      .all(date)
    return rows.map((row) => ({
      ...mapHabit(row),
      count: Number(row.check_count ?? 0)
    }))
  },

  create(input: HabitInput): Habit {
    const db = getDb()
    const maxRow = db
      .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM habits')
      .get() as { next: number }
    const res = db
      .prepare('INSERT INTO habits (name, icon, target, sort_order) VALUES (?, ?, ?, ?)')
      .run(input.name.trim(), input.icon || '✅', Math.max(1, input.target || 1), Number(maxRow.next))
    return this.get(Number(res.lastInsertRowid))!
  },

  get(id: number): Habit | null {
    const row = getDb().prepare('SELECT * FROM habits WHERE id = ?').get(id)
    return row ? mapHabit(row) : null
  },

  update(id: number, patch: Partial<HabitInput>): Habit | null {
    const current = this.get(id)
    if (!current) return null
    const next = { ...current, ...patch }
    getDb()
      .prepare('UPDATE habits SET name = ?, icon = ?, target = ? WHERE id = ?')
      .run(next.name.trim(), next.icon || '✅', Math.max(1, next.target || 1), id)
    return this.get(id)
  },

  remove(id: number): void {
    getDb().prepare('DELETE FROM habits WHERE id = ?').run(id)
  },

  /**
   * 打卡增减：delta 为 +1 表示打卡一次，-1 表示撤销一次。
   * 次数被限制在 [0, target*3] 区间内，返回最新进度。
   */
  checkIn(id: number, date: string, delta: number): HabitWithProgress | null {
    const habit = this.get(id)
    if (!habit) return null
    const db = getDb()
    const row = db
      .prepare('SELECT count FROM habit_logs WHERE habit_id = ? AND date = ?')
      .get(id, date) as { count: number } | undefined
    const nextCount = Math.min(Math.max(Number(row?.count ?? 0) + delta, 0), habit.target * 3)
    if (row) {
      db.prepare('UPDATE habit_logs SET count = ? WHERE habit_id = ? AND date = ?').run(
        nextCount,
        id,
        date
      )
    } else {
      db.prepare('INSERT INTO habit_logs (habit_id, date, count) VALUES (?, ?, ?)').run(
        id,
        date,
        nextCount
      )
    }
    return { ...habit, count: nextCount }
  },

  /** 指定日期内每个习惯的打卡次数（用于趋势统计） */
  countsByDate(date: string): Array<{ habitId: number; count: number }> {
    const rows = getDb()
      .prepare('SELECT habit_id, count FROM habit_logs WHERE date = ?')
      .all(date)
    return rows.map((row) => ({
      habitId: Number(row.habit_id),
      count: Number(row.count ?? 0)
    }))
  },

  /** 打卡「已达标」的习惯数量与总目标数量（用于今日概览） */
  completion(date: string): { done: number; total: number } {
    const habits = this.list(date)
    const done = habits.filter((h) => h.count >= h.target).length
    return { done, total: habits.length }
  },

  /** 某习惯的所有打卡日期（用于连续打卡统计） */
  checkedDates(habitId: number): string[] {
    const rows = getDb()
      .prepare('SELECT date FROM habit_logs WHERE habit_id = ? AND count > 0 ORDER BY date DESC')
      .all(habitId)
    return rows.map((row) => String(row.date))
  },

  /** 全部打卡记录（导出备份用） */
  totalCheckCount(): number {
    const row = getDb()
      .prepare('SELECT COALESCE(SUM(count), 0) AS c FROM habit_logs')
      .get() as { c: number }
    return Number(row.c ?? 0)
  }
}