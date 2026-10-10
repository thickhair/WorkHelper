/**
 * 演示数据写入脚本（开发/测试辅助）：向本地数据库写入一批示例数据，
 * 便于界面验证与截图。运行方式：node scripts/seed-demo.cjs
 * 注意：会先清空业务表，再写入示例数据。
 */
const os = require('os')
const path = require('path')
const fs = require('fs')
const Database = require('better-sqlite3')

const dbRoot =
  process.env.WORKBENCH_DATA_DIR || path.join(os.homedir(), 'AppData', 'Roaming', 'Workbench')
const dbPath = path.join(dbRoot, 'data', 'workbench.db')
if (!fs.existsSync(dbPath)) {
  console.error('数据库不存在，请先启动一次应用：', dbPath)
  process.exit(1)
}

/** 本地日期 YYYY-MM-DD */
function localDate(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

const db = new Database(dbPath)
db.pragma('foreign_keys = ON')

const today = localDate(0)
const yesterday = localDate(-1)
const tomorrow = localDate(1)

db.exec(`
  DELETE FROM habit_logs;
  DELETE FROM schedules;
  DELETE FROM focus_logs;
`)

/* ------------------------------ 日程 ------------------------------ */
const schedules = [
  ['07:00', '起床 + 早餐', '开启一天，元气满满', 1],
  ['08:00', '英语学习', '单词背诵 + 阅读练习', 1],
  ['09:30', '剪辑学习', '学习视频剪辑技巧', 0],
  ['11:30', '午餐 + 休息', '好好吃一顿，补充能量', 0],
  ['14:00', '减肥运动', '有氧运动 15 分钟', 0],
  ['16:00', '阅读书籍', '充实提升自己', 0],
  ['20:00', '工作复盘', '回顾今天，规划明天', 0],
  ['22:30', '睡觉', '早睡早起，保持良好状态', 0]
]
const insertSchedule = db.prepare(
  'INSERT INTO schedules (date, time, title, description, done, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
)
schedules.forEach(([time, title, description, done], index) =>
  insertSchedule.run(today, time, title, description, done, index)
)

/* ---------------------------- 习惯打卡 ---------------------------- */
const habits = db.prepare('SELECT id, name, target FROM habits ORDER BY sort_order').all()
const insertLog = db.prepare(
  'INSERT OR REPLACE INTO habit_logs (habit_id, date, count) VALUES (?, ?, ?)'
)
const habitPlan = {
  跑步: [1, 1, 1, 0, 1, 1, 1],
  英语学习: [1, 1, 1, 1, 1, 1, 1],
  阅读: [0, 1, 0, 1, 1, 0, 1],
  多喝水: [2, 2, 1, 2, 2, 2, 1],
  早起: [1, 0, 1, 1, 1, 0, 1]
}
habits.forEach((habit) => {
  const plan = habitPlan[habit.name] ?? [1, 1, 1, 1, 1, 1, 1]
  plan.forEach((count, index) => {
    if (count > 0) insertLog.run(habit.id, localDate(index - 6), count)
  })
})
// 今天：跑步、英语学习已达标
const running = habits.find((h) => h.name === '跑步')
const english = habits.find((h) => h.name === '英语学习')
if (running) insertLog.run(running.id, today, 1)
if (english) insertLog.run(english.id, today, 1)

/* ---------------------------- 专注记录 ---------------------------- */
const insertFocus = db.prepare('INSERT INTO focus_logs (date, title, minutes) VALUES (?, ?, ?)')
insertFocus.run(today, '英语精读', 25)
insertFocus.run(today, '剪辑练习', 45)
insertFocus.run(yesterday, '短视频初剪', 50)
insertFocus.run(localDate(-2), '读书笔记整理', 30)

/* ---------------------------- 侧边栏配置 ---------------------------- */
const sidebar = JSON.stringify(['assets'])
const sidebarExists = db.prepare("SELECT 1 AS ok FROM settings WHERE key = 'sidebar'").get()
if (sidebarExists) {
  db.prepare("UPDATE settings SET value = ? WHERE key = 'sidebar'").run(sidebar)
} else {
  db.prepare("INSERT INTO settings (key, value) VALUES ('sidebar', ?)").run(sidebar)
}

db.close()
console.log('DEMO_DATA_OK', today)