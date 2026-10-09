/**
 * 任务领域服务：日程（schedules）、待办（todos）、重要事项（priorities）的增删改查。
 * 所有写操作均使用参数化 SQL，避免注入风险。
 */
import { getDb } from '../db/database'
import type {
  PriorityInput,
  PriorityTask,
  Schedule,
  ScheduleInput,
  Todo,
  TodoInput
} from '@shared/types'

/* ------------------------------ 行映射工具 ------------------------------ */

function toBool(value: unknown): boolean {
  return Number(value) === 1
}

function mapSchedule(row: Record<string, unknown>): Schedule {
  return {
    id: Number(row.id),
    date: String(row.date),
    time: String(row.time),
    title: String(row.title),
    description: String(row.description ?? ''),
    done: toBool(row.done),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at ?? '')
  }
}

function mapTodo(row: Record<string, unknown>): Todo {
  return {
    id: Number(row.id),
    date: String(row.date),
    title: String(row.title),
    startTime: String(row.start_time ?? ''),
    endTime: String(row.end_time ?? ''),
    done: toBool(row.done),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at ?? '')
  }
}

function mapPriority(row: Record<string, unknown>): PriorityTask {
  return {
    id: Number(row.id),
    date: String(row.date),
    title: String(row.title),
    startTime: String(row.start_time ?? ''),
    endTime: String(row.end_time ?? ''),
    priority: String(row.priority ?? 'medium') as PriorityTask['priority'],
    done: toBool(row.done),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at ?? '')
  }
}

/* -------------------------------- 日程 -------------------------------- */

export const scheduleService = {
  list(date: string): Schedule[] {
    const rows = getDb()
      .prepare('SELECT * FROM schedules WHERE date = ? ORDER BY time ASC, sort_order ASC, id ASC')
      .all(date)
    return rows.map(mapSchedule)
  },

  create(input: ScheduleInput): Schedule {
    const db = getDb()
    const maxRow = db
      .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM schedules WHERE date = ?')
      .get(input.date) as { next: number }
    const res = db
      .prepare(
        `INSERT INTO schedules (date, time, title, description, done, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.date,
        input.time,
        input.title.trim(),
        input.description ?? '',
        input.done ? 1 : 0,
        input.sortOrder ?? Number(maxRow.next)
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
        `UPDATE schedules SET date = ?, time = ?, title = ?, description = ?, done = ?, sort_order = ?
         WHERE id = ?`
      )
      .run(
        next.date,
        next.time,
        next.title.trim(),
        next.description ?? '',
        next.done ? 1 : 0,
        next.sortOrder,
        id
      )
    return this.get(id)
  },

  toggle(id: number, done: boolean): Schedule | null {
    getDb().prepare('UPDATE schedules SET done = ? WHERE id = ?').run(done ? 1 : 0, id)
    return this.get(id)
  },

  remove(id: number): void {
    getDb().prepare('DELETE FROM schedules WHERE id = ?').run(id)
  }
}

/* -------------------------------- 待办 -------------------------------- */

export const todoService = {
  list(date: string): Todo[] {
    const rows = getDb()
      .prepare(
        `SELECT * FROM todos WHERE date = ?
         ORDER BY CASE WHEN start_time = '' THEN 1 ELSE 0 END, start_time ASC, sort_order ASC, id ASC`
      )
      .all(date)
    return rows.map(mapTodo)
  },

  create(input: TodoInput): Todo {
    const db = getDb()
    const maxRow = db
      .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM todos WHERE date = ?')
      .get(input.date) as { next: number }
    const res = db
      .prepare(
        `INSERT INTO todos (date, title, start_time, end_time, done, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.date,
        input.title.trim(),
        input.startTime ?? '',
        input.endTime ?? '',
        input.done ? 1 : 0,
        input.sortOrder ?? Number(maxRow.next)
      )
    return this.get(Number(res.lastInsertRowid))!
  },

  get(id: number): Todo | null {
    const row = getDb().prepare('SELECT * FROM todos WHERE id = ?').get(id)
    return row ? mapTodo(row) : null
  },

  update(id: number, patch: Partial<TodoInput>): Todo | null {
    const current = this.get(id)
    if (!current) return null
    const next = { ...current, ...patch }
    getDb()
      .prepare(
        `UPDATE todos SET date = ?, title = ?, start_time = ?, end_time = ?, done = ?, sort_order = ?
         WHERE id = ?`
      )
      .run(
        next.date,
        next.title.trim(),
        next.startTime ?? '',
        next.endTime ?? '',
        next.done ? 1 : 0,
        next.sortOrder,
        id
      )
    return this.get(id)
  },

  toggle(id: number, done: boolean): Todo | null {
    getDb().prepare('UPDATE todos SET done = ? WHERE id = ?').run(done ? 1 : 0, id)
    return this.get(id)
  },

  remove(id: number): void {
    getDb().prepare('DELETE FROM todos WHERE id = ?').run(id)
  }
}

/* ------------------------------ 重要事项 ------------------------------ */

export const priorityService = {
  list(date: string): PriorityTask[] {
    const rows = getDb()
      .prepare(
        `SELECT * FROM priorities WHERE date = ?
         ORDER BY CASE WHEN start_time = '' THEN 1 ELSE 0 END, start_time ASC, sort_order ASC, id ASC`
      )
      .all(date)
    return rows.map(mapPriority)
  },

  create(input: PriorityInput): PriorityTask {
    const db = getDb()
    const maxRow = db
      .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM priorities WHERE date = ?')
      .get(input.date) as { next: number }
    const res = db
      .prepare(
        `INSERT INTO priorities (date, title, start_time, end_time, priority, done, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.date,
        input.title.trim(),
        input.startTime ?? '',
        input.endTime ?? '',
        input.priority ?? 'medium',
        input.done ? 1 : 0,
        input.sortOrder ?? Number(maxRow.next)
      )
    return this.get(Number(res.lastInsertRowid))!
  },

  get(id: number): PriorityTask | null {
    const row = getDb().prepare('SELECT * FROM priorities WHERE id = ?').get(id)
    return row ? mapPriority(row) : null
  },

  update(id: number, patch: Partial<PriorityInput>): PriorityTask | null {
    const current = this.get(id)
    if (!current) return null
    const next = { ...current, ...patch }
    getDb()
      .prepare(
        `UPDATE priorities SET date = ?, title = ?, start_time = ?, end_time = ?, priority = ?, done = ?, sort_order = ?
         WHERE id = ?`
      )
      .run(
        next.date,
        next.title.trim(),
        next.startTime ?? '',
        next.endTime ?? '',
        next.priority,
        next.done ? 1 : 0,
        next.sortOrder,
        id
      )
    return this.get(id)
  },

  toggle(id: number, done: boolean): PriorityTask | null {
    getDb().prepare('UPDATE priorities SET done = ? WHERE id = ?').run(done ? 1 : 0, id)
    return this.get(id)
  },

  remove(id: number): void {
    getDb().prepare('DELETE FROM priorities WHERE id = ?').run(id)
  }
}