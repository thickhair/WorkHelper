/**
 * 预加载脚本：通过 contextBridge 向渲染进程暴露白名单 API。
 * 渲染进程开启 contextIsolation 且禁用 nodeIntegration，只能调用此处暴露的方法。
 */
import { contextBridge, ipcRenderer } from 'electron'
import type { Anniversary, AnniversaryInput } from '../shared/anniversaries'
import type {
  AppSettings,
  AssetAccount,
  AssetAccountInput,
  AssetCategoryStat,
  AssetRecordInput,
  AssetRecordWithAccount,
  AssetsSummary,
  AssetTrendPoint,
  Birthday,
  BirthdayInput,
  DayStats,
  Habit,
  HabitInput,
  HabitWithProgress,
  MoodRecord,
  PriorityInput,
  PriorityTask,
  SavingDeposit,
  SavingGoalInput,
  SavingGoalWithProgress,
  Schedule,
  ScheduleInput,
  StorageInfo,
  Todo,
  TodoInput,
  TrendPoint
} from '../shared/types'
import type { WeatherResult } from '../shared/weather'

/** 统一调用封装：主进程返回 { ok, data, error }，此处解包并抛出友好错误 */
async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const res = (await ipcRenderer.invoke(channel, ...args)) as
    | { ok: true; data: T }
    | { ok: false; error: string }
  if (!res || res.ok !== true) {
    throw new Error((res as { error?: string })?.error ?? '操作失败，请重试')
  }
  return res.data
}

const api = {
  /** 窗口控制 */
  win: {
    minimize: (): Promise<void> => invoke('window:minimize'),
    toggleMaximize: (): Promise<boolean> => invoke('window:toggle-maximize'),
    close: (): Promise<void> => invoke('window:close'),
    isMaximized: (): Promise<boolean> => invoke('window:is-maximized'),
    onMaximizeChange: (callback: (maximized: boolean) => void): void => {
      ipcRenderer.removeAllListeners('window:maximized-changed')
      ipcRenderer.on('window:maximized-changed', (_event, maximized: boolean) => callback(maximized))
    }
  },

  /** 应用设置与数据安全 */
  app: {
    getSettings: (): Promise<AppSettings> => invoke('app:get-settings'),
    setUserName: (name: string): Promise<void> => invoke('app:set-user-name', name),
    setSidebar: (ids: string[]): Promise<string[]> => invoke('app:set-sidebar', ids),
    setTheme: (id: string): Promise<string> => invoke('app:set-theme', id),
    driver: (): Promise<string> => invoke('app:driver'),
    exportBackup: (): Promise<string | null> => invoke('app:export-backup'),
    importBackup: (): Promise<string | null> => invoke('app:import-backup'),
    openDataDir: (): Promise<void> => invoke('app:open-data-dir'),
    openExternal: (url: string): Promise<void> => invoke('app:open-external', url),
    storageInfo: (): Promise<StorageInfo> => invoke('app:storage-info'),
    changeStorage: (): Promise<string | null> => invoke('app:change-storage')
  },

  /** 日程 */
  schedules: {
    list: (date: string): Promise<Schedule[]> => invoke('schedules:list', date),
    range: (from: string, to: string): Promise<Schedule[]> => invoke('schedules:range', from, to),
    create: (input: ScheduleInput): Promise<Schedule> => invoke('schedules:create', input),
    update: (id: number, patch: Partial<ScheduleInput>): Promise<Schedule> =>
      invoke('schedules:update', id, patch),
    toggle: (id: number, done: boolean): Promise<Schedule> => invoke('schedules:toggle', id, done),
    remove: (id: number): Promise<void> => invoke('schedules:remove', id)
  },

  /** 待办 */
  todos: {
    list: (date: string): Promise<Todo[]> => invoke('todos:list', date),
    create: (input: TodoInput): Promise<Todo> => invoke('todos:create', input),
    update: (id: number, patch: Partial<TodoInput>): Promise<Todo> =>
      invoke('todos:update', id, patch),
    toggle: (id: number, done: boolean): Promise<Todo> => invoke('todos:toggle', id, done),
    remove: (id: number): Promise<void> => invoke('todos:remove', id)
  },

  /** 重要事项 */
  priorities: {
    list: (date: string): Promise<PriorityTask[]> => invoke('priorities:list', date),
    create: (input: PriorityInput): Promise<PriorityTask> => invoke('priorities:create', input),
    update: (id: number, patch: Partial<PriorityInput>): Promise<PriorityTask> =>
      invoke('priorities:update', id, patch),
    toggle: (id: number, done: boolean): Promise<PriorityTask> =>
      invoke('priorities:toggle', id, done),
    remove: (id: number): Promise<void> => invoke('priorities:remove', id)
  },

  /** 习惯打卡 */
  habits: {
    list: (date: string): Promise<HabitWithProgress[]> => invoke('habits:list', date),
    create: (input: HabitInput): Promise<Habit> => invoke('habits:create', input),
    update: (id: number, patch: Partial<HabitInput>): Promise<Habit> =>
      invoke('habits:update', id, patch),
    remove: (id: number): Promise<void> => invoke('habits:remove', id),
    checkIn: (id: number, date: string, delta: number): Promise<HabitWithProgress> =>
      invoke('habits:check-in', id, date, delta)
  },

  /** 数据统计（首页与每日计划页） */
  stats: {
    day: (date: string): Promise<DayStats> => invoke('stats:day', date),
    trend: (days?: number): Promise<TrendPoint[]> => invoke('stats:trend', days ?? 7)
  },

  /** 专注计时记录（每日计划页专注计时落库） */
  focus: {
    create: (payload: { date: string; title: string; minutes: number }): Promise<void> =>
      invoke('focus:create', payload)
  },

  /** 生日（支持公历 / 农历与提前提醒） */
  birthdays: {
    list: (): Promise<Birthday[]> => invoke('birthdays:list'),
    save: (input: BirthdayInput): Promise<Birthday> => invoke('birthdays:save', input),
    remove: (id: number): Promise<void> => invoke('birthdays:remove', id)
  },

  /** 倒数日与纪念日（日历右键菜单管理） */
  anniversaries: {
    list: (): Promise<Anniversary[]> => invoke('anniversaries:list'),
    save: (input: AnniversaryInput): Promise<Anniversary> =>
      invoke('anniversaries:save', input),
    remove: (id: number): Promise<void> => invoke('anniversaries:remove', id)
  },

  /** 资产：多平台账户与收支记录 */
  assets: {
    accounts: (): Promise<AssetAccount[]> => invoke('assets:accounts'),
    saveAccount: (input: AssetAccountInput): Promise<AssetAccount> =>
      invoke('assets:save-account', input),
    removeAccount: (id: number): Promise<void> => invoke('assets:remove-account', id),
    records: (filter?: {
      month?: string
      kind?: 'income' | 'expense'
      accountId?: number
      limit?: number
    }): Promise<AssetRecordWithAccount[]> => invoke('assets:records', filter ?? {}),
    saveRecord: (input: AssetRecordInput): Promise<AssetRecordWithAccount> =>
      invoke('assets:save-record', input),
    removeRecord: (id: number): Promise<void> => invoke('assets:remove-record', id),
    summary: (): Promise<AssetsSummary> => invoke('assets:summary'),
    trend: (days?: number): Promise<AssetTrendPoint[]> => invoke('assets:trend', days ?? 30),
    categoryStats: (kind: 'income' | 'expense', month?: string): Promise<AssetCategoryStat[]> =>
      invoke('assets:category-stats', kind, month)
  },

  /** 攒钱计划与「想买」目标 */
  savings: {
    list: (kind: 'plan' | 'wish'): Promise<SavingGoalWithProgress[]> =>
      invoke('savings:list', kind),
    save: (input: SavingGoalInput): Promise<SavingGoalWithProgress> =>
      invoke('savings:save', input),
    remove: (id: number): Promise<void> => invoke('savings:remove', id),
    deposit: (goalId: number, amount: number, note?: string): Promise<SavingGoalWithProgress> =>
      invoke('savings:deposit', goalId, amount, note ?? ''),
    deposits: (goalId: number): Promise<SavingDeposit[]> => invoke('savings:deposits', goalId)
  },

  /** 每日心情（首页一键记录 + 日历展示） */
  moods: {
    range: (from: string, to: string): Promise<MoodRecord[]> => invoke('moods:range', from, to),
    set: (date: string, mood: number | null): Promise<MoodRecord | null> =>
      invoke('moods:set', date, mood)
  },

  /** 天气（自动定位 + 未来一周预报，主进程缓存） */
  weather: {
    report: (force?: boolean): Promise<WeatherResult> => invoke('weather:report', force ?? false)
  }
}

export type WorkbenchApi = typeof api

contextBridge.exposeInMainWorld('api', api)