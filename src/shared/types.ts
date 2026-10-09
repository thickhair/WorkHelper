/**
 * 共享类型定义：主进程（数据层 / IPC）与渲染进程共用。
 * 所有日期字段统一使用 `YYYY-MM-DD` 字符串，时间字段使用 `HH:mm` 字符串。
 */

/** 日程（带固定时间的当日安排） */
export interface Schedule {
  id: number
  date: string
  time: string
  title: string
  description: string
  done: boolean
  sortOrder: number
  createdAt: string
}

export type ScheduleInput = Omit<Schedule, 'id' | 'createdAt' | 'sortOrder'> & {
  sortOrder?: number
}

/** 待办事项 */
export interface Todo {
  id: number
  date: string
  title: string
  startTime: string
  endTime: string
  done: boolean
  sortOrder: number
  createdAt: string
}

export type TodoInput = Omit<Todo, 'id' | 'createdAt' | 'sortOrder'> & {
  sortOrder?: number
}

/** 习惯定义 */
export interface Habit {
  id: number
  name: string
  icon: string
  target: number
  sortOrder: number
  archived: boolean
}

export interface HabitInput {
  name: string
  icon: string
  target: number
}

/** 习惯 + 指定日期的打卡进度 */
export interface HabitWithProgress extends Habit {
  count: number
}

/** 重要事项优先级 */
export type PriorityLevel = 'high' | 'medium' | 'low'

/** 重要事项 */
export interface PriorityTask {
  id: number
  date: string
  title: string
  startTime: string
  endTime: string
  priority: PriorityLevel
  done: boolean
  sortOrder: number
  createdAt: string
}

export type PriorityInput = Omit<PriorityTask, 'id' | 'createdAt' | 'sortOrder'> & {
  sortOrder?: number
}

/** 分类模块（侧边栏学习/生活主题空间） */
export interface ModuleInfo {
  key: string
  name: string
  icon: string
  goal: string
  sortOrder: number
}

/** 分类模块投入记录 */
export interface ModuleRecord {
  id: number
  moduleKey: string
  date: string
  title: string
  duration: number
  note: string
  createdAt: string
}

export type ModuleRecordInput = Omit<ModuleRecord, 'id' | 'createdAt'>

/** 分类模块笔记 */
export interface ModuleNote {
  id: number
  moduleKey: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

export type ModuleNoteInput = Omit<ModuleNote, 'id' | 'createdAt' | 'updatedAt'>

/** 新闻资讯条目 */
export interface NewsItem {
  id: number
  title: string
  source: string
  url: string
  summary: string
  tags: string
  favorite: boolean
  createdAt: string
}

export type NewsInput = Omit<NewsItem, 'id' | 'createdAt'>

/** 工作复盘（每天一篇） */
export interface Review {
  id: number
  date: string
  doneText: string
  problemText: string
  planText: string
  mood: number
  createdAt: string
  updatedAt: string
}

export type ReviewInput = Omit<Review, 'id' | 'createdAt' | 'updatedAt'>

/** 专注计时记录 */
export interface FocusLog {
  id: number
  date: string
  title: string
  minutes: number
  createdAt: string
}

/** 单日汇总统计 */
export interface DayStats {
  date: string
  taskDone: number
  taskTotal: number
  habitDone: number
  habitTotal: number
  progress: number
  statusLabel: string
}

/** 近 N 天趋势中的单日数据 */
export interface TrendPoint {
  date: string
  taskDone: number
  taskTotal: number
  habitCount: number
  habitTarget: number
  focusMinutes: number
}

/** 分类模块投入统计 */
export interface ModuleTrend {
  moduleKey: string
  name: string
  icon: string
  minutes: number
  records: number
}

/** 数据统计页面聚合数据 */
export interface StatsOverview {
  totalTaskDone: number
  totalHabitChecks: number
  streakDays: number
  totalFocusMinutes: number
  trends: TrendPoint[]
  modules: ModuleTrend[]
}

/** 专注空间概览（今日总时长 + 最近记录） */
export interface FocusOverview {
  todayMinutes: number
  recent: FocusLog[]
}

/** 应用设置 */
export interface AppSettings {
  userName: string
  dataPath: string
  version: string
  /** 侧边栏中已添加的功能 id 列表（来自「功能广场」配置） */
  sidebar: string[]
  /** 当前主题 id（见 shared/themes.ts） */
  theme: string
}

/** 备份文件结构 */
export interface BackupPayload {
  app: string
  version: string
  exportedAt: string
  tables: Record<string, unknown[]>
  settings: Record<string, string>
}

/** 统一 IPC 返回结构 */
export interface ApiResult<T> {
  ok: boolean
  data?: T
  error?: string
}