/**
 * 共享纯函数逻辑：日期处理、进度计算、状态推导等。
 * 不依赖 Electron / Node API，可在渲染进程与单元测试中直接使用。
 */

const WEEK_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/** Date 对象 → `YYYY-MM-DD` */
export function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** `YYYY-MM-DD` → Date（本地时区零点），非法输入返回今天 */
export function parseDate(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return new Date()
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/** 日期加减天数，返回 `YYYY-MM-DD` */
export function addDays(date: string, days: number): string {
  const d = parseDate(date)
  d.setDate(d.getDate() + days)
  return formatDate(d)
}

/** 返回 `周六` 形式的中文星期 */
export function weekdayLabel(date: string): string {
  return WEEK_LABELS[parseDate(date).getDay()]
}

/** 返回 `8月15日` 形式的中文日期 */
export function monthDayLabel(date: string): string {
  const d = parseDate(date)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

/** 是否同一天 */
export function isSameDay(a: string, b: string): boolean {
  return a === b
}

/** 按小时返回问候语 */
export function greetingByHour(hour: number): string {
  if (hour < 6) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

/**
 * 计算今日进度（0-100）。
 * 任务与习惯合并加权：完成项 / 总项。
 */
export function computeProgress(
  taskDone: number,
  taskTotal: number,
  habitDone: number,
  habitTotal: number
): number {
  const total = taskTotal + habitTotal
  if (total <= 0) return 0
  const done = taskDone + habitDone
  return Math.round((done / total) * 100)
}

/** 根据进度推导今日状态文案 */
export function statusLabel(progress: number, hasItems = true): string {
  if (!hasItems) return '等待计划'
  if (progress >= 80) return '状态极佳'
  if (progress >= 50) return '保持专注'
  if (progress >= 20) return '继续加油'
  return '开始行动'
}

/** 从日程列表中挑选「下一个任务」：当日未完成且时间最接近当前时刻的一条 */
export function nextTaskOf<T extends { time: string; done: boolean }>(
  schedules: T[],
  now: Date = new Date()
): T | null {
  const pending = schedules.filter((s) => !s.done)
  if (pending.length === 0) return null
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const withMinutes = pending.map((s) => ({ item: s, minutes: timeToMinutes(s.time) }))
  const upcoming = withMinutes.filter((x) => x.minutes >= nowMinutes)
  if (upcoming.length > 0) {
    upcoming.sort((a, b) => a.minutes - b.minutes)
    return upcoming[0].item
  }
  // 今日时间已全部过去时，返回最早的一条未完成任务
  withMinutes.sort((a, b) => a.minutes - b.minutes)
  return withMinutes[0].item
}

/** `HH:mm` → 分钟数；非法输入返回 0 */
export function timeToMinutes(time: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time ?? '')
  if (!m) return 0
  return Number(m[1]) * 60 + Number(m[2])
}

/** 分钟数 → `1 小时 20 分钟` 形式 */
export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '0 分钟'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h > 0 && m > 0) return `${h} 小时 ${m} 分钟`
  if (h > 0) return `${h} 小时`
  return `${m} 分钟`
}

/** 计算习惯连续打卡天数（从 today 往前回溯，dates 为已打卡日期集合） */
export function habitStreak(dates: string[], today: string): number {
  const set = new Set(dates)
  let streak = 0
  let cursor = today
  while (set.has(cursor)) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

/** 计算时间段时长（分钟），end 早于 start 时按跨 0 点处理 */
export function durationBetween(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0
  const diff = timeToMinutes(endTime) - timeToMinutes(startTime)
  return diff > 0 ? diff : diff + 24 * 60
}

/** 百分比（安全除零），返回 0-100 整数 */
export function percent(done: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.round((done / total) * 100))
}

/** 生成近 n 天的日期数组（含今天），按时间升序 */
export function recentDates(today: string, n: number): string[] {
  const list: string[] = []
  for (let i = n - 1; i >= 0; i -= 1) {
    list.push(addDays(today, -i))
  }
  return list
}