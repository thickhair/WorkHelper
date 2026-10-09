/**
 * 每日心情服务：按日期区间查询、单日读取与写入（写入 null 表示清除）。
 * 心情等级取值 1-5，写入前统一收敛到合法范围。
 */
import { getDb } from '../db/database'
import type { MoodRecord } from '@shared/types'

/** 数据库行 → 心情记录 */
function mapMood(row: Record<string, unknown>): MoodRecord {
  return {
    date: String(row.date),
    mood: Number(row.mood),
    updatedAt: String(row.updated_at ?? '')
  }
}

export const moodService = {
  /** 指定日期区间（含首尾）内的心情记录，按日期升序 */
  range(from: string, to: string): MoodRecord[] {
    const rows = getDb()
      .prepare('SELECT * FROM moods WHERE date >= ? AND date <= ? ORDER BY date ASC')
      .all(from, to)
    return rows.map(mapMood)
  },

  get(date: string): MoodRecord | null {
    const row = getDb().prepare('SELECT * FROM moods WHERE date = ?').get(date)
    return row ? mapMood(row) : null
  },

  /** 设置某日心情（1-5）；mood 为 null 时清除该日记录 */
  set(date: string, mood: number | null): MoodRecord | null {
    const db = getDb()
    if (mood === null) {
      db.prepare('DELETE FROM moods WHERE date = ?').run(date)
      return null
    }
    const raw = Number(mood)
    const value = Number.isFinite(raw) ? Math.min(5, Math.max(1, Math.round(raw))) : 3
    db.prepare(
      `INSERT INTO moods (date, mood, updated_at) VALUES (?, ?, datetime('now','localtime'))
       ON CONFLICT(date) DO UPDATE SET mood = excluded.mood, updated_at = excluded.updated_at`
    ).run(date, value)
    return this.get(date)
  }
}