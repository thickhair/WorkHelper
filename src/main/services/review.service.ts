/**
 * 工作复盘服务：每天一篇复盘日记（日期唯一），保存时自动 upsert。
 */
import { getDb } from '../db/database'
import type { Review, ReviewInput } from '@shared/types'

function mapReview(row: Record<string, unknown>): Review {
  return {
    id: Number(row.id),
    date: String(row.date),
    doneText: String(row.done_text ?? ''),
    problemText: String(row.problem_text ?? ''),
    planText: String(row.plan_text ?? ''),
    mood: Number(row.mood ?? 3),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? '')
  }
}

export const reviewService = {
  /** 全部复盘（日期倒序） */
  list(): Review[] {
    const rows = getDb().prepare('SELECT * FROM reviews ORDER BY date DESC LIMIT 500').all()
    return rows.map(mapReview)
  },

  get(date: string): Review | null {
    const row = getDb().prepare('SELECT * FROM reviews WHERE date = ?').get(date)
    return row ? mapReview(row) : null
  },

  /** 保存复盘：同一天存在则更新，否则新增 */
  save(input: ReviewInput): Review {
    const db = getDb()
    const existing = this.get(input.date)
    if (existing) {
      db.prepare(
        `UPDATE reviews SET done_text = ?, problem_text = ?, plan_text = ?, mood = ?,
         updated_at = datetime('now','localtime') WHERE date = ?`
      ).run(input.doneText ?? '', input.problemText ?? '', input.planText ?? '', input.mood ?? 3, input.date)
      return this.get(input.date)!
    }
    db.prepare(
      `INSERT INTO reviews (date, done_text, problem_text, plan_text, mood) VALUES (?, ?, ?, ?, ?)`
    ).run(input.date, input.doneText ?? '', input.problemText ?? '', input.planText ?? '', input.mood ?? 3)
    return this.get(input.date)!
  },

  remove(date: string): void {
    getDb().prepare('DELETE FROM reviews WHERE date = ?').run(date)
  }
}