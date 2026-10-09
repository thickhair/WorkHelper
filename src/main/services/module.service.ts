/**
 * 分类模块服务：模块信息（目标）、投入记录、模块笔记。
 */
import { getDb } from '../db/database'
import type {
  ModuleInfo,
  ModuleNote,
  ModuleNoteInput,
  ModuleRecord,
  ModuleRecordInput,
  ModuleTrend
} from '@shared/types'

function mapModule(row: Record<string, unknown>): ModuleInfo {
  return {
    key: String(row.key),
    name: String(row.name),
    icon: String(row.icon ?? '📌'),
    goal: String(row.goal ?? ''),
    sortOrder: Number(row.sort_order ?? 0)
  }
}

function mapRecord(row: Record<string, unknown>): ModuleRecord {
  return {
    id: Number(row.id),
    moduleKey: String(row.module_key),
    date: String(row.date),
    title: String(row.title),
    duration: Number(row.duration ?? 0),
    note: String(row.note ?? ''),
    createdAt: String(row.created_at ?? '')
  }
}

function mapNote(row: Record<string, unknown>): ModuleNote {
  return {
    id: Number(row.id),
    moduleKey: String(row.module_key),
    title: String(row.title),
    content: String(row.content ?? ''),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? '')
  }
}

export const moduleService = {
  /* ----------------------------- 模块信息 ----------------------------- */

  list(): ModuleInfo[] {
    const rows = getDb().prepare('SELECT * FROM modules ORDER BY sort_order ASC').all()
    return rows.map(mapModule)
  },

  get(key: string): ModuleInfo | null {
    const row = getDb().prepare('SELECT * FROM modules WHERE key = ?').get(key)
    return row ? mapModule(row) : null
  },

  updateGoal(key: string, goal: string): ModuleInfo | null {
    getDb().prepare('UPDATE modules SET goal = ? WHERE key = ?').run(goal, key)
    return this.get(key)
  },

  /* ----------------------------- 投入记录 ----------------------------- */

  records(moduleKey: string): ModuleRecord[] {
    const rows = getDb()
      .prepare(
        'SELECT * FROM module_records WHERE module_key = ? ORDER BY date DESC, id DESC LIMIT 500'
      )
      .all(moduleKey)
    return rows.map(mapRecord)
  },

  createRecord(input: ModuleRecordInput): ModuleRecord {
    const res = getDb()
      .prepare(
        `INSERT INTO module_records (module_key, date, title, duration, note)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(input.moduleKey, input.date, input.title.trim(), Math.max(0, input.duration || 0), input.note ?? '')
    return this.getRecord(Number(res.lastInsertRowid))!
  },

  getRecord(id: number): ModuleRecord | null {
    const row = getDb().prepare('SELECT * FROM module_records WHERE id = ?').get(id)
    return row ? mapRecord(row) : null
  },

  updateRecord(id: number, patch: Partial<ModuleRecordInput>): ModuleRecord | null {
    const current = this.getRecord(id)
    if (!current) return null
    const next = { ...current, ...patch }
    getDb()
      .prepare(
        `UPDATE module_records SET module_key = ?, date = ?, title = ?, duration = ?, note = ?
         WHERE id = ?`
      )
      .run(
        next.moduleKey,
        next.date,
        next.title.trim(),
        Math.max(0, next.duration || 0),
        next.note ?? '',
        id
      )
    return this.getRecord(id)
  },

  removeRecord(id: number): void {
    getDb().prepare('DELETE FROM module_records WHERE id = ?').run(id)
  },

  /** 模块累计统计（次数 / 时长 / 最近记录日期） */
  summary(moduleKey: string): { records: number; minutes: number; lastDate: string } {
    const row = getDb()
      .prepare(
        `SELECT COUNT(*) AS c, COALESCE(SUM(duration), 0) AS m, COALESCE(MAX(date), '') AS last
         FROM module_records WHERE module_key = ?`
      )
      .get(moduleKey) as { c: number; m: number; last: string }
    return { records: Number(row.c ?? 0), minutes: Number(row.m ?? 0), lastDate: String(row.last ?? '') }
  },

  /* ------------------------------ 模块笔记 ------------------------------ */

  notes(moduleKey: string): ModuleNote[] {
    const rows = getDb()
      .prepare('SELECT * FROM module_notes WHERE module_key = ? ORDER BY updated_at DESC, id DESC')
      .all(moduleKey)
    return rows.map(mapNote)
  },

  createNote(input: ModuleNoteInput): ModuleNote {
    const res = getDb()
      .prepare('INSERT INTO module_notes (module_key, title, content) VALUES (?, ?, ?)')
      .run(input.moduleKey, input.title.trim(), input.content ?? '')
    return this.getNote(Number(res.lastInsertRowid))!
  },

  getNote(id: number): ModuleNote | null {
    const row = getDb().prepare('SELECT * FROM module_notes WHERE id = ?').get(id)
    return row ? mapNote(row) : null
  },

  updateNote(id: number, patch: Partial<ModuleNoteInput>): ModuleNote | null {
    const current = this.getNote(id)
    if (!current) return null
    const next = { ...current, ...patch }
    getDb()
      .prepare(
        `UPDATE module_notes SET title = ?, content = ?, updated_at = datetime('now','localtime')
         WHERE id = ?`
      )
      .run(next.title.trim(), next.content ?? '', id)
    return this.getNote(id)
  },

  removeNote(id: number): void {
    getDb().prepare('DELETE FROM module_notes WHERE id = ?').run(id)
  },

  /* ------------------------------ 汇总统计 ------------------------------ */

  /** 各模块累计投入时长排行（数据统计页使用） */
  trend(): ModuleTrend[] {
    const rows = getDb()
      .prepare(
        `SELECT m.key AS module_key, m.name, m.icon,
                COALESCE(SUM(r.duration), 0) AS minutes, COUNT(r.id) AS records
         FROM modules m
         LEFT JOIN module_records r ON r.module_key = m.key
         GROUP BY m.key
         ORDER BY minutes DESC, m.sort_order ASC`
      )
      .all()
    return rows.map((row) => ({
      moduleKey: String(row.module_key),
      name: String(row.name),
      icon: String(row.icon ?? '📌'),
      minutes: Number(row.minutes ?? 0),
      records: Number(row.records ?? 0)
    }))
  }
}