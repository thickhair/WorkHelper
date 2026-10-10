/**
 * 日程领域服务：schedules 表的增删改查与清单手动排序。
 * 所有写操作均使用参数化 SQL，避免注入风险。
 */
import { getDb } from '../db/database'
import type { SqliteDatabase } from '../db/sqlite-adapter'
import type { Schedule, ScheduleInput } from '@shared/types'

/* ------------------------------ 行映射工具 ------------------------------ */

function toBool(value: unknown): boolean {
  return Number(value) === 1
}

function mapSchedule(row: Record<string, unknown>): Schedule {
  return {
    id: Number(row.id),
    date: String(row.date),
    time: String(row.time ?? ''),
    title: String(row.title),
    description: String(row.description ?? ''),
    color: String(row.color ?? ''),
    pinned: toBool(row.pinned),
    done: toBool(row.done),
    completedAt: String(row.completed_at ?? ''),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at ?? '')
  }
}

/** 当日最大 sort_order + 1，用于新建项追加到「未设置时间」组内末尾 */
function nextSortOrder(db: SqliteDatabase, date: string): number {
  const row = db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM schedules WHERE date = ?')
    .get(date) as { next: number }
  return Number(row.next)
}

/* -------------------------------- 日程 -------------------------------- */

export const scheduleService = {
  list(date: string): Schedule[] {
    const rows = getDb()
      .prepare(
        `SELECT * FROM schedules WHERE date = ?
         ORDER BY pinned DESC,
                  CASE WHEN time = '' THEN 1 ELSE 0 END ASC,
                  time ASC, sort_order ASC, id ASC`
      )
      .all(date)
    return rows.map(mapSchedule)
  },

  /** 指定日期区间（含首尾）内的全部日程，供日历月视图使用 */
  listRange(from: string, to: string): Schedule[] {
    const rows = getDb()
      .prepare(
        'SELECT * FROM schedules WHERE date >= ? AND date <= ? ORDER BY date ASC, time ASC, id ASC'
      )
      .all(from, to)
    return rows.map(mapSchedule)
  },

  create(input: ScheduleInput): Schedule {
    const db = getDb()
    const res = db
      .prepare(
        `INSERT INTO schedules (date, time, title, description, color, pinned, done, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.date,
        input.time ?? '',
        input.title.trim(),
        input.description ?? '',
        input.color ?? '',
        input.pinned ? 1 : 0,
        input.done ? 1 : 0,
        input.sortOrder ?? nextSortOrder(db, input.date)
      )
    return this.get(Number(res.lastInsertRowid))!
  },

  get(id: number): Schedule | null {
    const row = getDb().prepare('SELECT * FROM schedules WHERE id = ?').get(id)
    return row ? mapSchedule(row) : null
  },

  update(id: number, patch: Partial<ScheduleInput>): Schedule | null {
    const current = this.get(id)
    if (!current) return null
    const next = { ...current, ...patch }
    getDb()
      .prepare(
        `UPDATE schedules
         SET date = ?, time = ?, title = ?, description = ?, color = ?, pinned = ?, done = ?, sort_order = ?
         WHERE id = ?`
      )
      .run(
        next.date,
        next.time ?? '',
        next.title.trim(),
        next.description ?? '',
        next.color ?? '',
        next.pinned ? 1 : 0,
        next.done ? 1 : 0,
        next.sortOrder,
        id
      )
    return this.get(id)
  },

  /** 切换完成状态：完成时记录 completed_at，取消完成时清空 */
  toggle(id: number, done: boolean): Schedule | null {
    getDb()
      .prepare(
        `UPDATE schedules
         SET done = ?, completed_at = CASE WHEN ? = 1 THEN datetime('now','localtime') ELSE NULL END
         WHERE id = ?`
      )
      .run(done ? 1 : 0, done ? 1 : 0, id)
    return this.get(id)
  },

  remove(id: number): void {
    getDb().prepare('DELETE FROM schedules WHERE id = ?').run(id)
  },

  /**
   * 按给定顺序重编号当日日程的 sort_order（每日计划页拖拽落位后调用）。
   * 仅用于「未设置时间」的条目（设置时间的条目按时间排序，不参与手动顺序），整体在事务中提交。
   */
  reorder(ids: number[]): void {
    const db = getDb()
    db.exec('BEGIN')
    try {
      ids.forEach((id, index) => {
        db.prepare('UPDATE schedules SET sort_order = ? WHERE id = ?').run(index, id)
      })
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
  }
}