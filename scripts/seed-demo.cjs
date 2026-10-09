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
  DELETE FROM todos;
  DELETE FROM priorities;
  DELETE FROM module_records;
  DELETE FROM module_notes;
  DELETE FROM news;
  DELETE FROM reviews;
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

/* ------------------------------ 待办 ------------------------------ */
const todos = [
  ['背 50 个英语单词', '08:00', '09:00', 1],
  ['完成 15 分钟英语跟读', '09:00', '09:30', 1],
  ['剪辑一个短视频', '10:00', '11:00', 1],
  ['阅读 30 分钟书籍', '16:00', '16:30', 0],
  ['整理房间', '17:00', '17:30', 0],
  ['写今日复盘', '20:30', '21:00', 0]
]
const insertTodo = db.prepare(
  'INSERT INTO todos (date, title, start_time, end_time, done, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
)
todos.forEach(([title, start, end, done], index) =>
  insertTodo.run(today, title, start, end, done, index)
)

/* ---------------------------- 重要事项 ---------------------------- */
const priorities = [
  ['完成英语学习打卡', '08:00', '09:00', 'high', 1],
  ['完成有氧运动 15 分钟', '14:00', '15:00', 'medium', 0],
  ['完成剪辑视频发布', '16:00', '16:30', 'high', 0],
  ['整理本周工作复盘', '20:00', '21:00', 'low', 0]
]
const insertPriority = db.prepare(
  'INSERT INTO priorities (date, title, start_time, end_time, priority, done, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
)
priorities.forEach(([title, start, end, level, done], index) =>
  insertPriority.run(today, title, start, end, level, done, index)
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

/* ---------------------------- 分类记录 ---------------------------- */
const insertRecord = db.prepare(
  'INSERT INTO module_records (module_key, date, title, duration, note) VALUES (?, ?, ?, ?, ?)'
)
const records = [
  ['fitness', today, '有氧运动 15 分钟', 15, '跑步机快走 + 拉伸'],
  ['fitness', yesterday, '核心训练', 30, '平板支撑 3 组'],
  ['fitness', localDate(-2), '户外慢跑', 40, '配速 6 分 30 秒'],
  ['english', today, '背单词 50 个 + 跟读', 45, '完成 Chapter 3'],
  ['english', yesterday, '精听练习', 30, ''],
  ['editing', yesterday, '学习转场技巧', 50, '收藏了 5 个转场案例'],
  ['reading', localDate(-1), '《深度工作》第 2 章', 40, '记录时间块方法'],
  ['reading', localDate(-3), '《掌控习惯》第 1 章', 35, ''],
  ['podcast', localDate(-2), '收听《硅谷早知道》', 45, 'AI 应用趋势'],
  ['ai', localDate(-1), '实践提示词工程', 60, '结构化提示词模板'],
  ['creation', localDate(-2), '拆解爆款视频脚本', 35, '记录 3 个开头钩子'],
  ['expression', localDate(-3), '朗读练习', 20, ''],
  ['fashion', localDate(-4), '整理秋冬穿搭', 25, ''],
  ['podcast', localDate(-5), '收听《组织进化论》', 40, ''],
  ['ai', localDate(-6), '学习 AI 绘图工具', 50, '']
]
records.forEach((row) => insertRecord.run(...row))

/* ---------------------------- 模块笔记 ---------------------------- */
const insertNote = db.prepare(
  'INSERT INTO module_notes (module_key, title, content) VALUES (?, ?, ?)'
)
insertNote.run(
  'english',
  '高频口语表达整理',
  '1. 用 I would rather... 表达偏好\n2. 用 It depends on... 表达视情况而定\n3. 用 That makes sense 表示认同'
)
insertNote.run(
  'ai',
  '结构化提示词模板',
  '角色：你是资深效率教练\n任务：帮我拆解本周目标\n约束：输出 3 条可执行动作，每条不超过 20 字'
)
insertNote.run('fitness', '训练计划（周）', '周一/周三/周五：有氧 30 分钟\n周二/周四：核心训练 20 分钟\n周末：户外慢跑 5 公里')

/* ---------------------------- 新闻资讯 ---------------------------- */
const insertNews = db.prepare(
  'INSERT INTO news (title, source, url, summary, tags, favorite) VALUES (?, ?, ?, ?, ?, ?)'
)
insertNews.run(
  'AI 效率工具年度盘点：这 10 款值得收藏',
  '36氪',
  'https://36kr.com',
  '覆盖写作、绘图、会议纪要等场景的效率工具清单。',
  'AI 效率',
  1
)
insertNews.run(
  '如何用时间块管理法提升专注力',
  '少数派',
  'https://sspai.com',
  '把一天切分为若干时间块，为每块安排单一任务，减少上下文切换成本。',
  '效率 方法',
  0
)
insertNews.run(
  '短视频剪辑的 5 个转场技巧',
  '新片场',
  'https://www.xinpianchang.com',
  '从匹配剪辑到遮罩转场，让画面衔接更自然。',
  '剪辑 视频',
  0
)

/* ---------------------------- 工作复盘 ---------------------------- */
const insertReview = db.prepare(
  'INSERT INTO reviews (date, done_text, problem_text, plan_text, mood) VALUES (?, ?, ?, ?, ?)'
)
insertReview.run(
  yesterday,
  '完成英语学习 45 分钟，跑步 30 分钟；完成短视频初剪。',
  '下午容易分心，手机通知打断了 2 次专注。',
  '明天上午先完成剪辑定稿，下午安排 2 个专注时间块。',
  4
)
insertReview.run(
  localDate(-2),
  '完成核心训练与阅读，输出读书笔记 1 篇。',
  '阅读速度偏慢，容易逐字读。',
  '尝试用扫读 + 精读结合的方式读书。',
  3
)

/* ---------------------------- 专注记录 ---------------------------- */
const insertFocus = db.prepare('INSERT INTO focus_logs (date, title, minutes) VALUES (?, ?, ?)')
insertFocus.run(today, '英语精读', 25)
insertFocus.run(today, '剪辑练习', 45)
insertFocus.run(yesterday, '短视频初剪', 50)
insertFocus.run(localDate(-2), '读书笔记整理', 30)

/* ---------------------------- 侧边栏配置 ---------------------------- */
const sidebar = JSON.stringify([
  'plan',
  'm-fitness',
  'm-english',
  'm-editing',
  'm-podcast',
  'm-expression',
  'm-reading',
  'm-fashion',
  'm-creation',
  'm-ai',
  'news',
  'review',
  'stats',
  'focus'
])
const sidebarExists = db.prepare("SELECT 1 AS ok FROM settings WHERE key = 'sidebar'").get()
if (sidebarExists) {
  db.prepare("UPDATE settings SET value = ? WHERE key = 'sidebar'").run(sidebar)
} else {
  db.prepare("INSERT INTO settings (key, value) VALUES ('sidebar', ?)").run(sidebar)
}

db.close()
console.log('DEMO_DATA_OK', today)