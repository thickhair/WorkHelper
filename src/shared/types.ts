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

/** 专注计时记录 */
export interface FocusLog {
  id: number
  date: string
  title: string
  minutes: number
  createdAt: string
}

/** 生日（支持公历与农历，支持提前提醒） */
export interface Birthday {
  id: number
  /** 姓名 / 称呼 */
  name: string
  /** 历法：solar = 公历，lunar = 农历 */
  calendar: 'solar' | 'lunar'
  /** 月份：公历 1-12；农历 1-12（闰月按同号的非闰月计算） */
  month: number
  /** 日期：公历 1-31；农历 1-30 */
  day: number
  /** 提前提醒天数（0 = 当天提醒） */
  remindDays: number
  /** 备注 */
  note: string
  createdAt: string
}

/** 生日新增 / 编辑输入 */
export type BirthdayInput = Omit<Birthday, 'id' | 'createdAt'> & { id?: number }

/** 每日心情记录 */
export interface MoodRecord {
  /** 日期（YYYY-MM-DD） */
  date: string
  /** 心情等级 1-5（见 shared/moods.ts） */
  mood: number
  /** 更新时间 */
  updatedAt: string
}

/* ------------------------------ 资产模块 ------------------------------ */

/** 资产账户（多平台：支付宝 / 微信支付 / 京东金融 / 银行等） */
export interface AssetAccount {
  id: number
  /** 平台标识（见 shared/assets.ts 平台目录） */
  platform: string
  /** 自定义名称（如「招商工资卡」） */
  name: string
  /** 当前余额（元） */
  balance: number
  note: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type AssetAccountInput = Omit<AssetAccount, 'id' | 'createdAt' | 'updatedAt' | 'sortOrder'> & {
  id?: number
  sortOrder?: number
}

/** 收支记录 */
export interface AssetRecord {
  id: number
  accountId: number
  /** income = 收入，expense = 支出 */
  kind: 'income' | 'expense'
  category: string
  /** 金额（元，正数） */
  amount: number
  date: string
  note: string
  createdAt: string
}

export type AssetRecordInput = Omit<AssetRecord, 'id' | 'createdAt'> & { id?: number }

/** 带账户信息的收支记录（列表展示用） */
export interface AssetRecordWithAccount extends AssetRecord {
  accountName: string
  platform: string
}

/** 攒钱目标（kind = plan 攒钱计划 / wish 想买） */
export interface SavingGoal {
  id: number
  kind: 'plan' | 'wish'
  name: string
  /** 目标金额（元） */
  target: number
  /** 自动存款周期：daily / weekly / monthly / yearly；none 表示仅手动存入 */
  period: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'none'
  /** 每个周期计划存入金额（元） */
  perAmount: number
  startDate: string
  note: string
  done: boolean
  createdAt: string
}

export type SavingGoalInput = Omit<SavingGoal, 'id' | 'createdAt' | 'done'> & { id?: number }

/** 攒钱目标的存入明细 */
export interface SavingDeposit {
  id: number
  goalId: number
  amount: number
  date: string
  note: string
  createdAt: string
}

/** 攒钱目标 + 进度（列表展示用） */
export interface SavingGoalWithProgress extends SavingGoal {
  /** 已存金额（存入明细合计） */
  saved: number
  /** 完成百分比（0-100） */
  percent: number
}

/** 首页资产概览（金额默认隐藏，由前端控制显隐） */
export interface AssetsSummary {
  /** 总资产（全部账户余额合计） */
  total: number
  /** 账户数量 */
  accountCount: number
  /** 本月收入合计 */
  monthIncome: number
  /** 本月支出合计 */
  monthExpense: number
}

/** 资产趋势单日数据（由收支记录推算） */
export interface AssetTrendPoint {
  date: string
  /** 当日收入 */
  income: number
  /** 当日支出 */
  expense: number
  /** 当日结束时的估算总资产 */
  total: number
}

/** 收支分类统计条目 */
export interface AssetCategoryStat {
  category: string
  amount: number
  count: number
}

/** 数据存储位置信息 */
export interface StorageInfo {
  /** 当前数据库文件完整路径 */
  dataPath: string
  /** 当前数据目录 */
  dataDir: string
  /** 是否使用自定义位置（设置中更改过） */
  custom: boolean
  /** 是否为便携模式（WORKBENCH_DATA_DIR） */
  portable: boolean
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