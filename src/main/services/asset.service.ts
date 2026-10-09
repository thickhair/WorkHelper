/**
 * 资产服务：多平台账户管理、收支记录、首页概览、趋势推算与分类统计。
 * 金额统一以「元」为单位（REAL）；记录收支时联动更新账户余额。
 */
import { getDb } from '../db/database'
import { platformOf } from '@shared/assets'
import { formatDate, recentDates } from '@shared/logic'
import type {
  AssetAccount,
  AssetAccountInput,
  AssetCategoryStat,
  AssetRecordInput,
  AssetRecordWithAccount,
  AssetsSummary,
  AssetTrendPoint
} from '@shared/types'

/** 数据库行 → 资产账户 */
function mapAccount(row: Record<string, unknown>): AssetAccount {
  return {
    id: Number(row.id),
    platform: String(row.platform ?? 'other'),
    name: String(row.name),
    balance: Number(row.balance ?? 0),
    note: String(row.note ?? ''),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? '')
  }
}

/** 数据库行 → 带账户信息的收支记录 */
function mapRecord(row: Record<string, unknown>): AssetRecordWithAccount {
  return {
    id: Number(row.id),
    accountId: Number(row.account_id),
    kind: row.kind === 'income' ? 'income' : 'expense',
    category: String(row.category ?? '其他'),
    amount: Number(row.amount ?? 0),
    date: String(row.date),
    note: String(row.note ?? ''),
    createdAt: String(row.created_at ?? ''),
    accountName: String(row.account_name ?? ''),
    platform: String(row.platform ?? 'other')
  }
}

/** 金额合法性：必须为正数，收敛到两位小数 */
function money(value: number, label = '金额'): number {
  const raw = Number(value)
  if (!Number.isFinite(raw) || raw <= 0) throw new Error(`${label}需为大于 0 的数字`)
  return Math.round(raw * 100) / 100
}

export const assetService = {
  /* ------------------------------ 账户管理 ------------------------------ */

  /** 全部账户（按排序值与 id 升序） */
  accounts(): AssetAccount[] {
    const rows = getDb()
      .prepare('SELECT * FROM asset_accounts ORDER BY sort_order ASC, id ASC')
      .all() as Array<Record<string, unknown>>
    return rows.map(mapAccount)
  },

  /** 新增或更新账户（id 存在时更新；balance 直接以表单值为准） */
  saveAccount(input: AssetAccountInput): AssetAccount {
    const name = (input.name ?? '').trim()
    if (!name) throw new Error('请填写账户名称')
    const platform = platformOf(input.platform).key
    const balance = Math.round(Number(input.balance ?? 0) * 100) / 100
    if (!Number.isFinite(balance)) throw new Error('余额需为数字')
    const note = (input.note ?? '').trim()
    const db = getDb()
    if (input.id !== undefined) {
      db.prepare(
        `UPDATE asset_accounts SET platform = ?, name = ?, balance = ?, note = ?,
         updated_at = datetime('now','localtime') WHERE id = ?`
      ).run(platform, name, balance, note, input.id)
      const row = db.prepare('SELECT * FROM asset_accounts WHERE id = ?').get(input.id) as
        | Record<string, unknown>
        | undefined
      if (!row) throw new Error('账户不存在，可能已被删除')
      return mapAccount(row)
    }
    const maxOrder = db
      .prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM asset_accounts')
      .get() as { m: number }
    const result = db
      .prepare(
        `INSERT INTO asset_accounts (platform, name, balance, note, sort_order)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(platform, name, balance, note, Number(maxOrder.m ?? -1) + 1)
    const row = db
      .prepare('SELECT * FROM asset_accounts WHERE id = ?')
      .get(Number(result.lastInsertRowid)) as Record<string, unknown>
    return mapAccount(row)
  },

  /** 删除账户（收支记录级联删除） */
  removeAccount(id: number): void {
    getDb().prepare('DELETE FROM asset_accounts WHERE id = ?').run(id)
  },

  /* ------------------------------ 收支记录 ------------------------------ */

  /** 收支记录列表（按日期倒序，可按月份 / 类型 / 账户过滤） */
  records(filter: { month?: string; kind?: string; accountId?: number; limit?: number }): AssetRecordWithAccount[] {
    const db = getDb()
    const where: string[] = []
    const params: unknown[] = []
    if (filter.month && /^\d{4}-\d{2}$/.test(filter.month)) {
      where.push("r.date >= ? AND r.date <= ?")
      params.push(`${filter.month}-01`, `${filter.month}-31`)
    }
    if (filter.kind === 'income' || filter.kind === 'expense') {
      where.push('r.kind = ?')
      params.push(filter.kind)
    }
    if (filter.accountId !== undefined && Number.isFinite(Number(filter.accountId))) {
      where.push('r.account_id = ?')
      params.push(Number(filter.accountId))
    }
    const limit = Math.min(500, Math.max(1, Math.round(Number(filter.limit ?? 200))))
    const sql = `
      SELECT r.*, a.name AS account_name, a.platform AS platform
      FROM asset_records r
      JOIN asset_accounts a ON a.id = r.account_id
      ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY r.date DESC, r.id DESC
      LIMIT ?`
    const rows = db.prepare(sql).all(...(params as never[]), limit) as Array<Record<string, unknown>>
    return rows.map(mapRecord)
  },

  /**
   * 新增或更新收支记录，并联动账户余额：
   * - 新增：收入 +amount / 支出 -amount；
   * - 更新：先按旧记录反向冲正，再按新记录入账（换账户时两边联动）。
   */
  saveRecord(input: AssetRecordInput): AssetRecordWithAccount {
    const db = getDb()
    const accountId = Number(input.accountId)
    const account = db.prepare('SELECT * FROM asset_accounts WHERE id = ?').get(accountId) as
      | Record<string, unknown>
      | undefined
    if (!account) throw new Error('请选择有效的账户')
    const kind = input.kind === 'income' ? 'income' : 'expense'
    const amount = money(input.amount)
    const category = (input.category ?? '').trim() || (kind === 'income' ? '其他收入' : '其他支出')
    const date = /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : formatDate(new Date())
    const note = (input.note ?? '').trim()

    const signed = kind === 'income' ? amount : -amount
    db.exec('BEGIN')
    try {
      if (input.id !== undefined) {
        const old = db.prepare('SELECT * FROM asset_records WHERE id = ?').get(input.id) as
          | Record<string, unknown>
          | undefined
        if (!old) throw new Error('记录不存在，可能已被删除')
        const oldSigned = old.kind === 'income' ? -Number(old.amount) : Number(old.amount)
        db.prepare(
          "UPDATE asset_accounts SET balance = ROUND(balance + ?, 2), updated_at = datetime('now','localtime') WHERE id = ?"
        ).run(oldSigned, Number(old.account_id))
        db.prepare(
          `UPDATE asset_records SET account_id = ?, kind = ?, category = ?, amount = ?, date = ?, note = ?
           WHERE id = ?`
        ).run(accountId, kind, category, amount, date, note, input.id)
        db.prepare(
          "UPDATE asset_accounts SET balance = ROUND(balance + ?, 2), updated_at = datetime('now','localtime') WHERE id = ?"
        ).run(signed, accountId)
      } else {
        const result = db
          .prepare(
            `INSERT INTO asset_records (account_id, kind, category, amount, date, note)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .run(accountId, kind, category, amount, date, note)
        db.prepare(
          "UPDATE asset_accounts SET balance = ROUND(balance + ?, 2), updated_at = datetime('now','localtime') WHERE id = ?"
        ).run(signed, accountId)
        input.id = Number(result.lastInsertRowid)
      }
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
    const row = db
      .prepare(
        `SELECT r.*, a.name AS account_name, a.platform AS platform
         FROM asset_records r JOIN asset_accounts a ON a.id = r.account_id WHERE r.id = ?`
      )
      .get(input.id) as Record<string, unknown>
    return mapRecord(row)
  },

  /** 删除收支记录并冲正账户余额 */
  removeRecord(id: number): void {
    const db = getDb()
    const old = db.prepare('SELECT * FROM asset_records WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined
    if (!old) return
    const oldSigned = old.kind === 'income' ? -Number(old.amount) : Number(old.amount)
    db.exec('BEGIN')
    try {
      db.prepare('DELETE FROM asset_records WHERE id = ?').run(id)
      db.prepare(
        "UPDATE asset_accounts SET balance = ROUND(balance + ?, 2), updated_at = datetime('now','localtime') WHERE id = ?"
      ).run(oldSigned, Number(old.account_id))
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
  },

  /* ------------------------------ 统计与图表 ------------------------------ */

  /** 首页资产概览：总资产、账户数、本月收支 */
  summary(today = formatDate(new Date())): AssetsSummary {
    const db = getDb()
    const totalRow = db
      .prepare('SELECT COALESCE(SUM(balance), 0) AS t, COUNT(*) AS c FROM asset_accounts')
      .get() as { t: number; c: number }
    const month = today.slice(0, 7)
    const incomeRow = db
      .prepare(
        "SELECT COALESCE(SUM(amount), 0) AS s FROM asset_records WHERE kind = 'income' AND date >= ? AND date <= ?"
      )
      .get(`${month}-01`, `${month}-31`) as { s: number }
    const expenseRow = db
      .prepare(
        "SELECT COALESCE(SUM(amount), 0) AS s FROM asset_records WHERE kind = 'expense' AND date >= ? AND date <= ?"
      )
      .get(`${month}-01`, `${month}-31`) as { s: number }
    return {
      total: Math.round(Number(totalRow.t ?? 0) * 100) / 100,
      accountCount: Number(totalRow.c ?? 0),
      monthIncome: Math.round(Number(incomeRow.s ?? 0) * 100) / 100,
      monthExpense: Math.round(Number(expenseRow.s ?? 0) * 100) / 100
    }
  },

  /**
   * 近 n 天资产趋势：以当前总资产为基准，用窗口内的收支记录逐日回推。
   * （记录为手动维护，趋势为估算口径。）
   */
  trend(days = 30, today = formatDate(new Date())): AssetTrendPoint[] {
    const db = getDb()
    const dates = recentDates(today, days)
    const from = dates[0]
    const totalNow = Number(
      (db.prepare('SELECT COALESCE(SUM(balance), 0) AS t FROM asset_accounts').get() as { t: number }).t ?? 0
    )
    const rows = db
      .prepare(
        `SELECT date, kind, COALESCE(SUM(amount), 0) AS s
         FROM asset_records WHERE date >= ? AND date <= ? GROUP BY date, kind`
      )
      .all(from, today) as Array<{ date: string; kind: string; s: number }>
    const incomeMap = new Map<string, number>()
    const expenseMap = new Map<string, number>()
    for (const row of rows) {
      if (row.kind === 'income') incomeMap.set(String(row.date), Number(row.s))
      else expenseMap.set(String(row.date), Number(row.s))
    }
    // 窗口之后（明天起至今天之后无记录，忽略未来记录）的净流回推
    const afterRow = db
      .prepare(
        `SELECT COALESCE(SUM(CASE WHEN kind = 'income' THEN amount ELSE -amount END), 0) AS s
         FROM asset_records WHERE date > ?`
      )
      .get(today) as { s: number }
    let total = Math.round((totalNow - Number(afterRow.s ?? 0)) * 100) / 100
    const points: AssetTrendPoint[] = []
    for (let i = dates.length - 1; i >= 0; i -= 1) {
      const date = dates[i]
      const income = incomeMap.get(date) ?? 0
      const expense = expenseMap.get(date) ?? 0
      points.unshift({
        date,
        income: Math.round(income * 100) / 100,
        expense: Math.round(expense * 100) / 100,
        total: Math.round(total * 100) / 100
      })
      total = Math.round((total - income + expense) * 100) / 100
    }
    return points
  },

  /** 指定月份的收支分类统计（默认当月） */
  categoryStats(kind: 'income' | 'expense', month?: string): AssetCategoryStat[] {
    const db = getDb()
    const range = month && /^\d{4}-\d{2}$/.test(month) ? month : formatDate(new Date()).slice(0, 7)
    const rows = db
      .prepare(
        `SELECT category, COALESCE(SUM(amount), 0) AS s, COUNT(*) AS c
         FROM asset_records WHERE kind = ? AND date >= ? AND date <= ?
         GROUP BY category ORDER BY s DESC`
      )
      .all(kind, `${range}-01`, `${range}-31`) as Array<{ category: string; s: number; c: number }>
    return rows.map((row) => ({
      category: String(row.category),
      amount: Math.round(Number(row.s) * 100) / 100,
      count: Number(row.c)
    }))
  }
}
