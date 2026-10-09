/**
 * 设置与数据安全服务：应用设置、数据备份（导出 JSON）、数据恢复（导入 JSON）、
 * 打开数据目录与外链跳转。
 */
import { app, dialog, shell } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { getDataDir, getDb, getDbDriver, getDbPath } from '../db/database'
import { DEFAULT_SIDEBAR, normalizeSidebar } from '@shared/features'
import { normalizeTheme } from '@shared/themes'
import type { AppSettings, BackupPayload } from '@shared/types'

/** 备份涉及的表与列定义（按外键依赖顺序排列） */
const BACKUP_TABLES: Record<string, string[]> = {
  habits: ['id', 'name', 'icon', 'target', 'sort_order', 'archived'],
  habit_logs: ['id', 'habit_id', 'date', 'count'],
  schedules: ['id', 'date', 'time', 'title', 'description', 'done', 'sort_order', 'created_at'],
  todos: ['id', 'date', 'title', 'start_time', 'end_time', 'done', 'sort_order', 'created_at'],
  priorities: [
    'id',
    'date',
    'title',
    'start_time',
    'end_time',
    'priority',
    'done',
    'sort_order',
    'created_at'
  ],
  focus_logs: ['id', 'date', 'title', 'minutes', 'created_at'],
  birthdays: ['id', 'name', 'calendar', 'month', 'day', 'remind_days', 'note', 'created_at'],
  moods: ['date', 'mood', 'updated_at'],
  anniversaries: ['id', 'name', 'kind', 'year', 'month', 'day', 'note', 'created_at'],
  asset_accounts: ['id', 'platform', 'name', 'balance', 'note', 'sort_order', 'created_at', 'updated_at'],
  asset_records: ['id', 'account_id', 'kind', 'category', 'amount', 'date', 'note', 'created_at'],
  saving_goals: ['id', 'kind', 'name', 'target', 'period', 'per_amount', 'start_date', 'note', 'done', 'created_at'],
  saving_deposits: ['id', 'goal_id', 'amount', 'date', 'note', 'created_at'],
  settings: ['key', 'value']
}

export const settingsService = {
  get(): AppSettings {
    const db = getDb()
    const row = db.prepare("SELECT value FROM settings WHERE key = 'userName'").get() as
      | { value: string }
      | undefined
    return {
      userName: String(row?.value ?? ''),
      dataPath: getDbPath(),
      version: app.getVersion(),
      sidebar: this.getSidebar(),
      theme: this.getTheme()
    }
  },

  /** 读取主题配置（无配置或非法值回退默认主题） */
  getTheme(): string {
    const row = getDb().prepare("SELECT value FROM settings WHERE key = 'theme'").get() as
      | { value: string }
      | undefined
    return normalizeTheme(row?.value)
  },

  /** 保存主题配置，返回规范化后的主题 id */
  setTheme(id: string): string {
    const normalized = normalizeTheme(id)
    const db = getDb()
    const exists = db.prepare("SELECT 1 AS ok FROM settings WHERE key = 'theme'").get()
    if (exists) {
      db.prepare("UPDATE settings SET value = ? WHERE key = 'theme'").run(normalized)
    } else {
      db.prepare("INSERT INTO settings (key, value) VALUES ('theme', ?)").run(normalized)
    }
    return normalized
  },

  /** 读取侧边栏配置（无配置或格式错误时回退默认） */
  getSidebar(): string[] {
    const row = getDb().prepare("SELECT value FROM settings WHERE key = 'sidebar'").get() as
      | { value: string }
      | undefined
    if (!row) return [...DEFAULT_SIDEBAR]
    try {
      return normalizeSidebar(JSON.parse(row.value))
    } catch {
      return [...DEFAULT_SIDEBAR]
    }
  },

  /** 保存侧边栏配置，返回规范化后的结果 */
  setSidebar(ids: string[]): string[] {
    const normalized = normalizeSidebar(ids)
    const db = getDb()
    const value = JSON.stringify(normalized)
    const exists = db.prepare("SELECT 1 AS ok FROM settings WHERE key = 'sidebar'").get()
    if (exists) {
      db.prepare("UPDATE settings SET value = ? WHERE key = 'sidebar'").run(value)
    } else {
      db.prepare("INSERT INTO settings (key, value) VALUES ('sidebar', ?)").run(value)
    }
    return normalized
  },

  setUserName(name: string): void {
    const db = getDb()
    const exists = db.prepare("SELECT 1 AS ok FROM settings WHERE key = 'userName'").get()
    if (exists) {
      db.prepare("UPDATE settings SET value = ? WHERE key = 'userName'").run(name)
    } else {
      db.prepare("INSERT INTO settings (key, value) VALUES ('userName', ?)").run(name)
    }
  },

  /** 数据库驱动信息（关于页面展示） */
  driver(): string {
    return getDbDriver()
  },

  /** 导出全部数据为 JSON 文件，返回保存路径（用户取消时返回 null） */
  async exportBackup(): Promise<string | null> {
    const db = getDb()
    const result = await dialog.showSaveDialog({
      title: '导出数据备份',
      defaultPath: `Workbench-备份-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON 备份文件', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return null

    const tables: Record<string, unknown[]> = {}
    Object.entries(BACKUP_TABLES).forEach(([table, columns]) => {
      tables[table] = db.prepare(`SELECT ${columns.join(', ')} FROM ${table}`).all()
    })
    const payload: BackupPayload = {
      app: 'Workbench',
      version: app.getVersion(),
      exportedAt: new Date().toISOString(),
      tables,
      settings: {}
    }
    writeFileSync(result.filePath, JSON.stringify(payload, null, 2), 'utf-8')
    return result.filePath
  },

  /** 从 JSON 备份文件恢复数据（覆盖现有数据），返回恢复结果说明 */
  async importBackup(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      title: '选择备份文件进行恢复',
      properties: ['openFile'],
      filters: [{ name: 'JSON 备份文件', extensions: ['json'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null

    const raw = JSON.parse(readFileSync(result.filePaths[0], 'utf-8')) as BackupPayload
    if (raw.app !== 'Workbench' || !raw.tables) {
      throw new Error('备份文件格式不正确，无法恢复')
    }

    const db = getDb()
    db.exec('BEGIN')
    try {
      // 先清空业务表（按外键反向顺序），再按备份内容写入
      const orderedTables = Object.keys(BACKUP_TABLES)
      ;[...orderedTables].reverse().forEach((table) => {
        if (table !== 'settings') db.prepare(`DELETE FROM ${table}`).run()
      })
      Object.entries(BACKUP_TABLES).forEach(([table, columns]) => {
        const rows = (raw.tables[table] as Record<string, unknown>[]) ?? []
        if (rows.length === 0) return
        const placeholders = columns.map(() => '?').join(', ')
        const stmt = db.prepare(
          `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`
        )
        rows.forEach((row) => stmt.run(...columns.map((col) => row[col] as never)))
      })
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
    return result.filePaths[0]
  },

  /** 在资源管理器中打开数据目录 */
  async openDataDir(): Promise<void> {
    await shell.openPath(getDataDir())
  },

  /** 使用系统默认浏览器打开链接 */
  async openExternal(url: string): Promise<void> {
    if (!/^https?:\/\//i.test(url)) return
    await shell.openExternal(url)
  }
}

/** 专注计时记录服务（供每日计划页的专注计时落库） */
export const focusService = {
  create(payload: { date: string; title: string; minutes: number }): void {
    getDb()
      .prepare('INSERT INTO focus_logs (date, title, minutes) VALUES (?, ?, ?)')
      .run(payload.date, payload.title ?? '', Math.max(0, Math.round(payload.minutes || 0)))
  },

  todayMinutes(date: string): number {
    const row = getDb()
      .prepare('SELECT COALESCE(SUM(minutes), 0) AS m FROM focus_logs WHERE date = ?')
      .get(date) as { m: number }
    return Number(row.m ?? 0)
  }
}