/**
 * 数据库初始化：连接管理、版本迁移与默认数据种子。
 * 数据库文件位于 %APPDATA%/Workbench/data/workbench.db（WAL 模式）。
 */
import { app } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { openDatabase, SqliteDatabase } from './sqlite-adapter'

let instance: SqliteDatabase | null = null
let driverName = ''
/** 自定义数据目录（设置页更改数据存储位置后生效），null 表示使用默认目录 */
let dataDirOverride: string | null = null

/** 设置自定义数据目录（null 恢复默认；须在下次 getDb() 前调用） */
export function setDataDirOverride(dir: string | null): void {
  dataDirOverride = dir
}

/** 数据目录（默认 %APPDATA%/Workbench/data，可在设置中更改） */
export function getDataDir(): string {
  const dir = dataDirOverride ?? join(app.getPath('userData'), 'data')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

/** 数据库文件完整路径 */
export function getDbPath(): string {
  return join(getDataDir(), 'workbench.db')
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

/** V2 版本新增表结构：生日提醒（支持公历 / 农历与提前提醒） */
const SCHEMA_V2 = `
CREATE TABLE IF NOT EXISTS birthdays (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  calendar    TEXT    NOT NULL DEFAULT 'solar',
  month       INTEGER NOT NULL,
  day         INTEGER NOT NULL,
  remind_days INTEGER NOT NULL DEFAULT 0,
  note        TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);
`

/** V3 版本新增表结构：每日心情记录（首页一键打卡 + 日历展示） */
const SCHEMA_V3 = `
CREATE TABLE IF NOT EXISTS moods (
  date       TEXT    PRIMARY KEY,
  mood       INTEGER NOT NULL,
  updated_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);
`

/**
 * V4 版本变更：
 * 1. 移除功能广场改版前的 13 项功能（分类模块 / 新闻资讯 / 工作复盘），
 *    按用户确认连同历史数据一并删除；
 * 2. 新增「倒数日与纪念日」（anniversaries）；
 * 3. 新增「资产」模块表：平台账户（asset_accounts）、收支记录（asset_records）、
 *    攒钱目标（saving_goals，kind 区分攒钱计划 / 想买）与存入明细（saving_deposits）。
 * 金额统一以「元」为单位（REAL，展示时保留两位小数）。
 */
const SCHEMA_V4 = `
DROP TABLE IF EXISTS modules;
DROP TABLE IF EXISTS module_records;
DROP TABLE IF EXISTS module_notes;
DROP TABLE IF EXISTS news;
DROP TABLE IF EXISTS reviews;

CREATE TABLE IF NOT EXISTS anniversaries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  kind       TEXT    NOT NULL DEFAULT 'anniversary',
  year       INTEGER,
  month      INTEGER NOT NULL,
  day        INTEGER NOT NULL,
  note       TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS asset_accounts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  platform   TEXT    NOT NULL DEFAULT 'other',
  name       TEXT    NOT NULL,
  balance    REAL    NOT NULL DEFAULT 0,
  note       TEXT    NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS asset_records (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES asset_accounts(id) ON DELETE CASCADE,
  kind       TEXT    NOT NULL DEFAULT 'expense',
  category   TEXT    NOT NULL DEFAULT '其他',
  amount     REAL    NOT NULL DEFAULT 0,
  date       TEXT    NOT NULL,
  note       TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_asset_records_account ON asset_records(account_id);
CREATE INDEX IF NOT EXISTS idx_asset_records_date ON asset_records(date);

CREATE TABLE IF NOT EXISTS saving_goals (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT    NOT NULL DEFAULT 'plan',
  name       TEXT    NOT NULL,
  target     REAL    NOT NULL DEFAULT 0,
  period     TEXT    NOT NULL DEFAULT 'monthly',
  per_amount REAL    NOT NULL DEFAULT 0,
  start_date TEXT    NOT NULL,
  note       TEXT    NOT NULL DEFAULT '',
  done       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS saving_deposits (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id    INTEGER NOT NULL REFERENCES saving_goals(id) ON DELETE CASCADE,
  amount     REAL    NOT NULL DEFAULT 0,
  date       TEXT    NOT NULL,
  note       TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_saving_deposits_goal ON saving_deposits(goal_id);
`

/** 版本迁移（基于 PRAGMA user_version） */
function migrate(db: SqliteDatabase): void {
  const row = db.prepare('PRAGMA user_version').get() as { user_version?: number } | undefined
  const version = Number(row?.user_version ?? 0)
  if (version < 1) {
    db.exec(SCHEMA_V1)
    db.exec('PRAGMA user_version = 1')
  }
  if (version < 2) {
    db.exec(SCHEMA_V2)
    db.exec('PRAGMA user_version = 2')
  }
  if (version < 3) {
    db.exec(SCHEMA_V3)
    db.exec('PRAGMA user_version = 3')
  }
  if (version < 4) {
    db.exec(SCHEMA_V4)
    db.exec('PRAGMA user_version = 4')
  }
  seedDefaults(db)
}

/** 写入默认习惯与基础设置（幂等） */
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

  const settingsCount = Number(
    (db.prepare("SELECT COUNT(*) AS c FROM settings WHERE key = 'userName'").get() as {
      c: number
    }).c
  )
  if (settingsCount === 0) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('userName', '')
  }
}