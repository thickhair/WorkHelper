/**
 * 攒钱服务：攒钱计划与「想买」目标（共用 saving_goals 表，kind 区分）及存入明细。
 * 进度 = 存入明细合计 / 目标金额；达到目标后自动标记完成。
 */
import { getDb } from '../db/database'
import { formatDate, percent } from '@shared/logic'
import type { SavingDeposit, SavingGoalInput, SavingGoalWithProgress } from '@shared/types'

const PERIODS = new Set(['daily', 'weekly', 'monthly', 'yearly', 'none'])

/** 数据库行 → 攒钱目标（含进度） */
function mapGoal(row: Record<string, unknown>): SavingGoalWithProgress {
  const saved = Math.round(Number(row.saved ?? 0) * 100) / 100
  const target = Math.round(Number(row.target ?? 0) * 100) / 100
  return {
    id: Number(row.id),
    kind: row.kind === 'wish' ? 'wish' : 'plan',
    name: String(row.name),
    target,
    period: (PERIODS.has(String(row.period)) ? String(row.period) : 'monthly') as
      | 'daily'
      | 'weekly'
      | 'monthly'
      | 'yearly'
      | 'none',
    perAmount: Math.round(Number(row.per_amount ?? 0) * 100) / 100,
    startDate: String(row.start_date ?? ''),
    note: String(row.note ?? ''),
    done: Number(row.done ?? 0) === 1,
    createdAt: String(row.created_at ?? ''),
    saved,
    percent: percent(saved, target)
  }
}

/** 数据库行 → 存入明细 */
function mapDeposit(row: Record<string, unknown>): SavingDeposit {
  return {
    id: Number(row.id),
    goalId: Number(row.goal_id),
    amount: Math.round(Number(row.amount ?? 0) * 100) / 100,
    date: String(row.date),
    note: String(row.note ?? ''),
    createdAt: String(row.created_at ?? '')
  }
}

export const savingsService = {
  /** 目标列表（kind = plan 攒钱计划 / wish 想买；未完成在前，按 id 倒序） */
  list(kind: 'plan' | 'wish'): SavingGoalWithProgress[] {
    const rows = getDb()
      .prepare(
        `SELECT g.*, COALESCE((SELECT SUM(amount) FROM saving_deposits d WHERE d.goal_id = g.id), 0) AS saved
         FROM saving_goals g WHERE g.kind = ?
         ORDER BY g.done ASC, g.id DESC`
      )
      .all(kind === 'wish' ? 'wish' : 'plan') as Array<Record<string, unknown>>
    return rows.map(mapGoal)
  },

  /** 新增或更新目标（id 存在时更新） */
  save(input: SavingGoalInput): SavingGoalWithProgress {
    const name = (input.name ?? '').trim()
    if (!name) throw new Error('请填写目标名称')
    const kind = input.kind === 'wish' ? 'wish' : 'plan'
    const target = Math.round(Number(input.target) * 100) / 100
    if (!Number.isFinite(target) || target <= 0) throw new Error('目标金额需为大于 0 的数字')
    const period = PERIODS.has(input.period) ? input.period : 'monthly'
    const perAmount = Math.round(Number(input.perAmount ?? 0) * 100) / 100
    if (period !== 'none' && (!Number.isFinite(perAmount) || perAmount <= 0)) {
      throw new Error('请填写每个周期计划存入的金额')
    }
    const startDate = /^\d{4}-\d{2}-\d{2}$/.test(input.startDate)
      ? input.startDate
      : formatDate(new Date())
    const note = (input.note ?? '').trim()
    const db = getDb()
    if (input.id !== undefined) {
      db.prepare(
        `UPDATE saving_goals SET name = ?, target = ?, period = ?, per_amount = ?, start_date = ?, note = ?
         WHERE id = ? AND kind = ?`
      ).run(name, target, period, perAmount, startDate, note, input.id, kind)
      const row = db
        .prepare(
          `SELECT g.*, COALESCE((SELECT SUM(amount) FROM saving_deposits d WHERE d.goal_id = g.id), 0) AS saved
           FROM saving_goals g WHERE g.id = ?`
        )
        .get(input.id) as Record<string, unknown> | undefined
      if (!row) throw new Error('目标不存在，可能已被删除')
      return mapGoal(row)
    }
    const result = db
      .prepare(
        `INSERT INTO saving_goals (kind, name, target, period, per_amount, start_date, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(kind, name, target, period, perAmount, startDate, note)
    const row = db
      .prepare(
        `SELECT g.*, COALESCE((SELECT SUM(amount) FROM saving_deposits d WHERE d.goal_id = g.id), 0) AS saved
         FROM saving_goals g WHERE g.id = ?`
      )
      .get(Number(result.lastInsertRowid)) as Record<string, unknown>
    return mapGoal(row)
  },

  /** 删除目标（存入明细级联删除） */
  remove(id: number): void {
    getDb().prepare('DELETE FROM saving_goals WHERE id = ?').run(id)
  },

  /** 存入一笔（达到目标后自动标记完成） */
  deposit(goalId: number, amount: number, note = '', date = formatDate(new Date())): SavingGoalWithProgress {
    const db = getDb()
    const goal = db.prepare('SELECT * FROM saving_goals WHERE id = ?').get(goalId) as
      | Record<string, unknown>
      | undefined
    if (!goal) throw new Error('目标不存在，可能已被删除')
    const value = Math.round(Number(amount) * 100) / 100
    if (!Number.isFinite(value) || value <= 0) throw new Error('存入金额需为大于 0 的数字')
    const day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : formatDate(new Date())
    db.prepare('INSERT INTO saving_deposits (goal_id, amount, date, note) VALUES (?, ?, ?, ?)').run(
      goalId,
      value,
      day,
      note.trim()
    )
    const row = db
      .prepare(
        `SELECT g.*, COALESCE((SELECT SUM(amount) FROM saving_deposits d WHERE d.goal_id = g.id), 0) AS saved
         FROM saving_goals g WHERE g.id = ?`
      )
      .get(goalId) as Record<string, unknown>
    const progress = mapGoal(row)
    if (progress.saved >= progress.target && !progress.done) {
      db.prepare('UPDATE saving_goals SET done = 1 WHERE id = ?').run(goalId)
      progress.done = true
    }
    return progress
  },

  /** 某目标的存入明细（按日期倒序） */
  deposits(goalId: number, limit = 50): SavingDeposit[] {
    const rows = getDb()
      .prepare('SELECT * FROM saving_deposits WHERE goal_id = ? ORDER BY date DESC, id DESC LIMIT ?')
      .all(goalId, Math.max(1, Math.round(limit))) as Array<Record<string, unknown>>
    return rows.map(mapDeposit)
  }
}
