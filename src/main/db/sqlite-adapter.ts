/**
 * SQLite 适配层：统一两种驱动（better-sqlite3 / node:sqlite）的调用接口。
 * 业务层仅依赖 SqliteDatabase 接口，便于替换驱动与单元测试。
 *
 * 驱动选择策略：
 * 1. 优先使用 better-sqlite3（性能最佳，随应用打包）；
 * 2. 加载失败时自动回退到 Node 内置的 node:sqlite（Node 22.5+ / Electron 内置 Node）。
 */
import Database from 'better-sqlite3'
import { DatabaseSync } from 'node:sqlite'

export interface SqliteRunResult {
  changes: number
  lastInsertRowid: number
}

export interface SqliteStatement {
  run(...params: unknown[]): SqliteRunResult
  get(...params: unknown[]): Record<string, unknown> | undefined
  all(...params: unknown[]): Record<string, unknown>[]
}

export interface SqliteDatabase {
  exec(sql: string): void
  prepare(sql: string): SqliteStatement
  close(): void
}

/** better-sqlite3 驱动封装 */
function createBetterSqlite(file: string): SqliteDatabase {
  const raw = new Database(file)
  raw.pragma('journal_mode = WAL')
  raw.pragma('synchronous = NORMAL')
  raw.pragma('foreign_keys = ON')
  return {
    exec: (sql) => {
      raw.exec(sql)
    },
    prepare: (sql) => {
      const stmt = raw.prepare(sql)
      return {
        run: (...params) => {
          const res = stmt.run(...params)
          return {
            changes: Number(res.changes),
            lastInsertRowid: Number(res.lastInsertRowid)
          }
        },
        get: (...params) => stmt.get(...params) as Record<string, unknown> | undefined,
        all: (...params) => stmt.all(...params) as Record<string, unknown>[]
      }
    },
    close: () => {
      raw.close()
    }
  }
}

/** node:sqlite 内置驱动封装 */
function createNodeSqlite(file: string): SqliteDatabase {
  const raw = new DatabaseSync(file)
  raw.exec('PRAGMA journal_mode = WAL')
  raw.exec('PRAGMA synchronous = NORMAL')
  raw.exec('PRAGMA foreign_keys = ON')
  return {
    exec: (sql) => {
      raw.exec(sql)
    },
    prepare: (sql) => {
      const stmt = raw.prepare(sql)
      return {
        run: (...params) => {
          const res = stmt.run(...(params as never[]))
          return {
            changes: Number(res.changes ?? 0),
            lastInsertRowid: Number(res.lastInsertRowid ?? 0)
          }
        },
        get: (...params) => stmt.get(...(params as never[])) as Record<string, unknown> | undefined,
        all: (...params) => stmt.all(...(params as never[])) as Record<string, unknown>[]
      }
    },
    close: () => {
      raw.close()
    }
  }
}

/** 打开数据库文件，返回可用的驱动实例与驱动名称 */
export function openDatabase(file: string): { db: SqliteDatabase; driver: string } {
  try {
    return { db: createBetterSqlite(file), driver: 'better-sqlite3' }
  } catch (err) {
    console.warn('[db] better-sqlite3 不可用，已回退到 node:sqlite 驱动：', err)
    return { db: createNodeSqlite(file), driver: 'node:sqlite' }
  }
}