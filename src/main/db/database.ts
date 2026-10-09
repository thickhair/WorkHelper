/**
 * 数据库初始化：连接管理、版本迁移与默认数据种子。
 * 数据库文件位于 %APPDATA%/WorkHelper/data/workhelper.db（WAL 模式）。
 */
import { app } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { openDatabase, SqliteDatabase } from './sqlite-adapter'

let instance: SqliteDatabase | null = null
let driverName = ''

/** 数据目录（%APPDATA%/WorkHelper/data） */
export function getDataDir(): string {
  const dir = join(app.getPath('userData'), 'data')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

/** 数据库文件完整路径 */
export function getDbPath(): string {
  return join(getDataDir(), 'workhelper.db')
}

/** 获取数据库单例（首次调用时完成迁移与种子写入） */
export function getDb(): SqliteDatabase {
  if (instance) return instance
  const opened = openDatabase(getDbPath())
  instance = opened.db
  driverName = opened.driver
  migrate(instance)
  return instance
}

/** 当前使用的数据库驱动名称 */
export function getDbDriver(): string {
  return driverName
}

/** 关闭数据库（应用退出时调用） */
export function closeDb(): void {
  if (instance) {
    try {
      instance.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    } catch {
      /* 忽略 checkpoint 异常 */
    }
    instance.close()
    instance = null
  }
}

/** V1 版本表结构 */
const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schedules (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT    NOT NULL,
  time        TEXT    NOT NULL,
  title       TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  done        INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(date);

CREATE TABLE IF NOT EXISTS todos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  date       TEXT    NOT NULL,
  title      TEXT    NOT NULL,
  start_time TEXT    NOT NULL DEFAULT '',
  end_time   TEXT    NOT NULL DEFAULT '',
  done       INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_todos_date ON todos(date);

CREATE TABLE IF NOT EXISTS habits (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  icon       TEXT    NOT NULL DEFAULT '✅',
  target     INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS habit_logs (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date     TEXT    NOT NULL,
  count    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (habit_id, date)
);
CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON habit_logs(date);

CREATE TABLE IF NOT EXISTS priorities (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  date       TEXT    NOT NULL,
  title      TEXT    NOT NULL,
  start_time TEXT    NOT NULL DEFAULT '',
  end_time   TEXT    NOT NULL DEFAULT '',
  priority   TEXT    NOT NULL DEFAULT 'medium',
  done       INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_priorities_date ON priorities(date);

CREATE TABLE IF NOT EXISTS modules (
  key        TEXT PRIMARY KEY,
  name       TEXT    NOT NULL,
  icon       TEXT    NOT NULL DEFAULT '📌',
  goal       TEXT    NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS module_records (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  module_key TEXT    NOT NULL REFERENCES modules(key) ON DELETE CASCADE,
  date       TEXT    NOT NULL,
  title      TEXT    NOT NULL,
  duration   INTEGER NOT NULL DEFAULT 0,
  note       TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_module_records_key ON module_records(module_key);

CREATE TABLE IF NOT EXISTS module_notes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  module_key TEXT    NOT NULL REFERENCES modules(key) ON DELETE CASCADE,
  title      TEXT    NOT NULL,
  content    TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_module_notes_key ON module_notes(module_key);

CREATE TABLE IF NOT EXISTS news (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL,
  source     TEXT    NOT NULL DEFAULT '',
  url        TEXT    NOT NULL DEFAULT '',
  summary    TEXT    NOT NULL DEFAULT '',
  tags       TEXT    NOT NULL DEFAULT '',
  favorite   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS reviews (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  date         TEXT    NOT NULL UNIQUE,
  done_text    TEXT    NOT NULL DEFAULT '',
  problem_text TEXT    NOT NULL DEFAULT '',
  plan_text    TEXT    NOT NULL DEFAULT '',
  mood         INTEGER NOT NULL DEFAULT 3,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS focus_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  date       TEXT    NOT NULL,
  title      TEXT    NOT NULL DEFAULT '',
  minutes    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_focus_logs_date ON focus_logs(date);
`

/** 版本迁移（基于 PRAGMA user_version） */
function migrate(db: SqliteDatabase): void {
  const row = db.prepare('PRAGMA user_version').get() as { user_version?: number } | undefined
  const version = Number(row?.user_version ?? 0)
  if (version < 1) {
    db.exec(SCHEMA_V1)
    db.exec('PRAGMA user_version = 1')
  }
  seedDefaults(db)
}

/** 写入默认习惯与分类模块（幂等） */
function seedDefaults(db: SqliteDatabase): void {
  const habitCount = Number(
    (db.prepare('SELECT COUNT(*) AS c FROM habits').get() as { c: number }).c
  )
  if (habitCount === 0) {
    const insert = db.prepare(
      'INSERT INTO habits (name, icon, target, sort_order) VALUES (?, ?, ?, ?)'
    )
    const defaults: Array<[string, string, number]> = [
      ['跑步', '🏃', 1],
      ['英语学习', '📖', 1],
      ['阅读', '📚', 1],
      ['多喝水', '💧', 2],
      ['早起', '🌅', 1]
    ]
    defaults.forEach(([name, icon, target], index) => insert.run(name, icon, target, index))
  }

  const moduleCount = Number(
    (db.prepare('SELECT COUNT(*) AS c FROM modules').get() as { c: number }).c
  )
  if (moduleCount === 0) {
    const insert = db.prepare(
      'INSERT INTO modules (key, name, icon, goal, sort_order) VALUES (?, ?, ?, ?, ?)'
    )
    const defaults: Array<[string, string, string, string]> = [
      ['fitness', '减肥运动', '🏃', '每周运动 5 次，保持健康体态'],
      ['english', '英语学习', '📖', '每天背 50 个单词，坚持跟读练习'],
      ['editing', '剪辑学习', '🎬', '掌握视频剪辑技巧，每周产出 1 条作品'],
      ['podcast', '播客精选', '🎧', '每周收听 3 期优质播客并记录收获'],
      ['expression', '表达能力', '💬', '每天练习表达 15 分钟，提升沟通力'],
      ['reading', '读书推荐', '📚', '每月读完 2 本书，输出读书笔记'],
      ['fashion', '妆容穿搭', '👗', '记录每日穿搭，形成个人风格'],
      ['creation', '爆款二创', '🔥', '每周拆解 3 个爆款，产出二次创作'],
      ['ai', 'AI学习', '🤖', '跟进 AI 前沿工具，每周实践 1 个新玩法']
    ]
    defaults.forEach(([key, name, icon, goal], index) =>
      insert.run(key, name, icon, goal, index)
    )
  }

  const settingsCount = Number(
    (db.prepare("SELECT COUNT(*) AS c FROM settings WHERE key = 'userName'").get() as {
      c: number
    }).c
  )
  if (settingsCount === 0) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('userName', '')
  }
}