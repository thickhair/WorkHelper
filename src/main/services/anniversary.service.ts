/**
 * 倒数日与纪念日服务：增删改查（日期合法性由共享层 normalizeAnniversary 校验）。
 */
import { getDb } from '../db/database'
import {
  normalizeAnniversary,
  type Anniversary,
  type AnniversaryInput
} from '@shared/anniversaries'

/** 数据库行 → 纪念日记录 */
function mapRow(row: Record<string, unknown>): Anniversary {
  return {
    id: Number(row.id),
    name: String(row.name),
    kind: row.kind === 'countdown' ? 'countdown' : 'anniversary',
    year: row.year === null || row.year === undefined ? null : Number(row.year),
    month: Number(row.month),
    day: Number(row.day),
    note: String(row.note ?? ''),
    createdAt: String(row.created_at ?? '')
  }
}

export const anniversaryService = {
  /** 全部记录（按月份、日期升序，便于界面按临近程度再排序） */
  list(): Anniversary[] {
    const rows = getDb()
      .prepare('SELECT * FROM anniversaries ORDER BY month ASC, day ASC, id ASC')
      .all() as Array<Record<string, unknown>>
    return rows.map(mapRow)
  },

  /** 新增或更新（id 存在时更新） */
  save(input: AnniversaryInput): Anniversary {
    const data = normalizeAnniversary(input)
    const db = getDb()
    if (data.id !== undefined) {
      db.prepare(
        `UPDATE anniversaries SET name = ?, kind = ?, year = ?, month = ?, day = ?, note = ?
         WHERE id = ?`
      ).run(data.name, data.kind, data.year, data.month, data.day, data.note, data.id)
      const row = db.prepare('SELECT * FROM anniversaries WHERE id = ?').get(data.id) as
        | Record<string, unknown>
        | undefined
      if (!row) throw new Error('记录不存在，可能已被删除')
      return mapRow(row)
    }
    const result = db
      .prepare(
        `INSERT INTO anniversaries (name, kind, year, month, day, note) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(data.name, data.kind, data.year, data.month, data.day, data.note)
    const row = db
      .prepare('SELECT * FROM anniversaries WHERE id = ?')
      .get(Number(result.lastInsertRowid)) as Record<string, unknown>
    return mapRow(row)
  },

  remove(id: number): void {
    getDb().prepare('DELETE FROM anniversaries WHERE id = ?').run(id)
  }
}
