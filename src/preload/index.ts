/**
 * 预加载脚本：通过 contextBridge 向渲染进程暴露白名单 API。
 * 渲染进程开启 contextIsolation 且禁用 nodeIntegration，只能调用此处暴露的方法。
 */
import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  DayStats,
  FocusOverview,
  Habit,
  HabitInput,
  HabitWithProgress,
  ModuleInfo,
  ModuleNote,
  ModuleNoteInput,
  ModuleRecord,
  ModuleRecordInput,
  NewsInput,
  NewsItem,
  PriorityInput,
  PriorityTask,
  Review,
  ReviewInput,
  Schedule,
  ScheduleInput,
  StatsOverview,
  Todo,
  TodoInput,
  TrendPoint
} from '../shared/types'

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
    openExternal: (url: string): Promise<void> => invoke('app:open-external', url)
  },

  /** 日程 */
  schedules: {
    list: (date: string): Promise<Schedule[]> => invoke('schedules:list', date),
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

  /** 分类模块 */
  modules: {
    list: (): Promise<ModuleInfo[]> => invoke('modules:list'),
    updateGoal: (key: string, goal: string): Promise<ModuleInfo> =>
      invoke('modules:update-goal', key, goal),
    records: (moduleKey: string): Promise<ModuleRecord[]> => invoke('modules:records', moduleKey),
    createRecord: (input: ModuleRecordInput): Promise<ModuleRecord> =>
      invoke('modules:create-record', input),
    updateRecord: (id: number, patch: Partial<ModuleRecordInput>): Promise<ModuleRecord> =>
      invoke('modules:update-record', id, patch),
    removeRecord: (id: number): Promise<void> => invoke('modules:remove-record', id),
    summary: (
      moduleKey: string
    ): Promise<{ records: number; minutes: number; lastDate: string }> =>
      invoke('modules:summary', moduleKey),
    notes: (moduleKey: string): Promise<ModuleNote[]> => invoke('modules:notes', moduleKey),
    createNote: (input: ModuleNoteInput): Promise<ModuleNote> =>
      invoke('modules:create-note', input),
    updateNote: (id: number, patch: Partial<ModuleNoteInput>): Promise<ModuleNote> =>
      invoke('modules:update-note', id, patch),
    removeNote: (id: number): Promise<void> => invoke('modules:remove-note', id)
  },

  /** 新闻资讯 */
  news: {
    list: (keyword?: string, favoriteOnly?: boolean): Promise<NewsItem[]> =>
      invoke('news:list', keyword ?? '', favoriteOnly ?? false),
    create: (input: NewsInput): Promise<NewsItem> => invoke('news:create', input),
    update: (id: number, patch: Partial<NewsInput>): Promise<NewsItem> =>
      invoke('news:update', id, patch),
    toggleFavorite: (id: number): Promise<NewsItem> => invoke('news:toggle-favorite', id),
    remove: (id: number): Promise<void> => invoke('news:remove', id)
  },

  /** 工作复盘 */
  reviews: {
    list: (): Promise<Review[]> => invoke('reviews:list'),
    get: (date: string): Promise<Review | null> => invoke('reviews:get', date),
    save: (input: ReviewInput): Promise<Review> => invoke('reviews:save', input),
    remove: (date: string): Promise<void> => invoke('reviews:remove', date)
  },

  /** 数据统计 */
  stats: {
    day: (date: string): Promise<DayStats> => invoke('stats:day', date),
    trend: (days?: number): Promise<TrendPoint[]> => invoke('stats:trend', days ?? 7),
    overview: (days?: number): Promise<StatsOverview> => invoke('stats:overview', days ?? 7)
  },

  /** 专注计时记录 */
  focus: {
    create: (payload: { date: string; title: string; minutes: number }): Promise<void> =>
      invoke('focus:create', payload),
    overview: (date: string, limit?: number): Promise<FocusOverview> =>
      invoke('focus:overview', date, limit ?? 20)
  }
}

export type WorkHelperApi = typeof api

contextBridge.exposeInMainWorld('api', api)