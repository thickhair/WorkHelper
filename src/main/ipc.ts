/**
 * IPC 主进程注册：所有渲染进程请求的处理器在此集中注册。
 * 统一返回 { ok, data, error } 结构，异常不会导致主进程崩溃。
 */
import { BrowserWindow, ipcMain } from 'electron'
import { habitService } from './services/habit.service'
import { moduleService } from './services/module.service'
import { newsService } from './services/news.service'
import { priorityService, scheduleService, todoService } from './services/task.service'
import { reviewService } from './services/review.service'
import { focusService, settingsService } from './services/settings.service'
import { statsService } from './services/stats.service'

/** 包装处理器：捕获异常并返回统一结构 */
function handle(channel: string, fn: (...args: never[]) => unknown): void {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      const data = await fn(...(args as never[]))
      return { ok: true, data }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[ipc] ${channel} 执行失败：`, message)
      return { ok: false, error: message }
    }
  })
}

export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  /* ------------------------------ 窗口控制 ------------------------------ */
  handle('window:minimize', () => {
    getMainWindow()?.minimize()
  })
  handle('window:toggle-maximize', () => {
    const win = getMainWindow()
    if (!win) return false
    if (win.isMaximized()) {
      win.unmaximize()
      return false
    }
    win.maximize()
    return true
  })
  handle('window:close', () => {
    getMainWindow()?.close()
  })
  handle('window:is-maximized', () => getMainWindow()?.isMaximized() ?? false)

  /* --------------------------- 设置与数据安全 --------------------------- */
  handle('app:get-settings', () => settingsService.get())
  handle('app:set-user-name', (name: string) => settingsService.setUserName(name))
  handle('app:set-sidebar', (ids: string[]) => settingsService.setSidebar(ids))
  handle('app:set-theme', (id: string) => settingsService.setTheme(id))
  handle('app:driver', () => settingsService.driver())
  handle('app:export-backup', () => settingsService.exportBackup())
  handle('app:import-backup', () => settingsService.importBackup())
  handle('app:open-data-dir', () => settingsService.openDataDir())
  handle('app:open-external', (url: string) => settingsService.openExternal(url))

  /* -------------------------------- 日程 -------------------------------- */
  handle('schedules:list', (date: string) => scheduleService.list(date))
  handle('schedules:create', (input: never) => scheduleService.create(input))
  handle('schedules:update', (id: number, patch: never) => scheduleService.update(id, patch))
  handle('schedules:toggle', (id: number, done: boolean) => scheduleService.toggle(id, done))
  handle('schedules:remove', (id: number) => scheduleService.remove(id))

  /* -------------------------------- 待办 -------------------------------- */
  handle('todos:list', (date: string) => todoService.list(date))
  handle('todos:create', (input: never) => todoService.create(input))
  handle('todos:update', (id: number, patch: never) => todoService.update(id, patch))
  handle('todos:toggle', (id: number, done: boolean) => todoService.toggle(id, done))
  handle('todos:remove', (id: number) => todoService.remove(id))

  /* ------------------------------ 重要事项 ------------------------------ */
  handle('priorities:list', (date: string) => priorityService.list(date))
  handle('priorities:create', (input: never) => priorityService.create(input))
  handle('priorities:update', (id: number, patch: never) => priorityService.update(id, patch))
  handle('priorities:toggle', (id: number, done: boolean) => priorityService.toggle(id, done))
  handle('priorities:remove', (id: number) => priorityService.remove(id))

  /* ------------------------------ 习惯打卡 ------------------------------ */
  handle('habits:list', (date: string) => habitService.list(date))
  handle('habits:create', (input: never) => habitService.create(input))
  handle('habits:update', (id: number, patch: never) => habitService.update(id, patch))
  handle('habits:remove', (id: number) => habitService.remove(id))
  handle('habits:check-in', (id: number, date: string, delta: number) =>
    habitService.checkIn(id, date, delta)
  )

  /* ------------------------------ 分类模块 ------------------------------ */
  handle('modules:list', () => moduleService.list())
  handle('modules:update-goal', (key: string, goal: string) => moduleService.updateGoal(key, goal))
  handle('modules:records', (key: string) => moduleService.records(key))
  handle('modules:create-record', (input: never) => moduleService.createRecord(input))
  handle('modules:update-record', (id: number, patch: never) => moduleService.updateRecord(id, patch))
  handle('modules:remove-record', (id: number) => moduleService.removeRecord(id))
  handle('modules:summary', (key: string) => moduleService.summary(key))
  handle('modules:notes', (key: string) => moduleService.notes(key))
  handle('modules:create-note', (input: never) => moduleService.createNote(input))
  handle('modules:update-note', (id: number, patch: never) => moduleService.updateNote(id, patch))
  handle('modules:remove-note', (id: number) => moduleService.removeNote(id))

  /* ------------------------------ 新闻资讯 ------------------------------ */
  handle('news:list', (keyword: string, favoriteOnly: boolean) =>
    newsService.list(keyword, favoriteOnly)
  )
  handle('news:create', (input: never) => newsService.create(input))
  handle('news:update', (id: number, patch: never) => newsService.update(id, patch))
  handle('news:toggle-favorite', (id: number) => newsService.toggleFavorite(id))
  handle('news:remove', (id: number) => newsService.remove(id))

  /* ------------------------------ 工作复盘 ------------------------------ */
  handle('reviews:list', () => reviewService.list())
  handle('reviews:get', (date: string) => reviewService.get(date))
  handle('reviews:save', (input: never) => reviewService.save(input))
  handle('reviews:remove', (date: string) => reviewService.remove(date))

  /* ------------------------------ 数据统计 ------------------------------ */
  handle('stats:day', (date: string) => statsService.day(date))
  handle('stats:trend', (days: number) => statsService.trend(days))
  handle('stats:overview', (days: number) => statsService.overview(days))

  /* ------------------------------ 专注计时 ------------------------------ */
  handle('focus:create', (payload: { date: string; title: string; minutes: number }) =>
    focusService.create(payload)
  )
  handle('focus:overview', (date: string, limit: number) => focusService.overview(date, limit))
}