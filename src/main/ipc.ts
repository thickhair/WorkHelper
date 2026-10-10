/**
 * IPC 主进程注册：所有渲染进程请求的处理器在此集中注册。
 * 统一返回 { ok, data, error } 结构，异常不会导致主进程崩溃。
 */
import { BrowserWindow, ipcMain } from 'electron'
import { anniversaryService } from './services/anniversary.service'
import { assetService } from './services/asset.service'
import { birthdayService } from './services/birthday.service'
import { bookService, bookmarkService } from './services/book.service'
import { habitService } from './services/habit.service'
import { moodService } from './services/mood.service'
import { savingsService } from './services/savings.service'
import { scheduleService } from './services/task.service'
import { focusService, settingsService } from './services/settings.service'
import { statsService } from './services/stats.service'
import { storageService } from './services/storage.service'
import { weatherService } from './services/weather.service'

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
  handle('window:set-fullscreen', (flag: boolean) => {
    const win = getMainWindow()
    if (!win) return false
    win.setFullScreen(flag === true)
    return win.isFullScreen()
  })

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

  /* ---------------------------- 数据存储位置 ---------------------------- */
  handle('app:storage-info', () => storageService.info())
  handle('app:change-storage', () => storageService.change(getMainWindow()))

  /* -------------------------------- 日程 -------------------------------- */
  handle('schedules:list', (date: string) => scheduleService.list(date))
  handle('schedules:range', (from: string, to: string) => scheduleService.listRange(from, to))
  handle('schedules:create', (input: never) => scheduleService.create(input))
  handle('schedules:update', (id: number, patch: never) => scheduleService.update(id, patch))
  handle('schedules:toggle', (id: number, done: boolean) => scheduleService.toggle(id, done))
  handle('schedules:remove', (id: number) => scheduleService.remove(id))
  handle('schedules:reorder', (ids: number[]) => scheduleService.reorder(ids))

  /* ------------------------------ 习惯打卡 ------------------------------ */
  handle('habits:list', (date: string) => habitService.list(date))
  handle('habits:create', (input: never) => habitService.create(input))
  handle('habits:update', (id: number, patch: never) => habitService.update(id, patch))
  handle('habits:remove', (id: number) => habitService.remove(id))
  handle('habits:check-in', (id: number, date: string, delta: number) =>
    habitService.checkIn(id, date, delta)
  )

  /* ------------------------------ 数据统计 ------------------------------ */
  handle('stats:day', (date: string) => statsService.day(date))
  handle('stats:trend', (days: number) => statsService.trend(days))

  /* ------------------------------ 专注计时 ------------------------------ */
  handle('focus:create', (payload: { date: string; title: string; minutes: number }) =>
    focusService.create(payload)
  )

  /* --------------------------- 日历与生日提醒 --------------------------- */
  handle('birthdays:list', () => birthdayService.list())
  handle('birthdays:save', (input: never) => birthdayService.save(input))
  handle('birthdays:remove', (id: number) => birthdayService.remove(id))

  /* --------------------------- 倒数日与纪念日 --------------------------- */
  handle('anniversaries:list', () => anniversaryService.list())
  handle('anniversaries:save', (input: never) => anniversaryService.save(input))
  handle('anniversaries:remove', (id: number) => anniversaryService.remove(id))

  /* -------------------------------- 资产 -------------------------------- */
  handle('assets:accounts', () => assetService.accounts())
  handle('assets:save-account', (input: never) => assetService.saveAccount(input))
  handle('assets:remove-account', (id: number) => assetService.removeAccount(id))
  handle('assets:records', (filter: never) => assetService.records(filter))
  handle('assets:save-record', (input: never) => assetService.saveRecord(input))
  handle('assets:remove-record', (id: number) => assetService.removeRecord(id))
  handle('assets:summary', () => assetService.summary())
  handle('assets:trend', (days: number) => assetService.trend(days))
  handle('assets:category-stats', (kind: 'income' | 'expense', month?: string) =>
    assetService.categoryStats(kind, month)
  )

  /* ----------------------------- 攒钱与想买 ----------------------------- */
  handle('savings:list', (kind: 'plan' | 'wish') => savingsService.list(kind))
  handle('savings:save', (input: never) => savingsService.save(input))
  handle('savings:remove', (id: number) => savingsService.remove(id))
  handle('savings:deposit', (goalId: number, amount: number, note: string) =>
    savingsService.deposit(goalId, amount, note)
  )
  handle('savings:deposits', (goalId: number) => savingsService.deposits(goalId))

  /* ------------------------------ 每日心情 ------------------------------ */
  handle('moods:range', (from: string, to: string) => moodService.range(from, to))
  handle('moods:set', (date: string, mood: number | null) => moodService.set(date, mood))

  /* -------------------------------- 天气 -------------------------------- */
  handle('weather:report', (force: boolean) => weatherService.report(force === true))

  /* -------------------------------- 阅读 -------------------------------- */
  handle('books:list', () => bookService.list())
  handle('books:get', (id: number) => bookService.get(id))
  handle('books:import', () => bookService.import(getMainWindow()))
  handle('books:remove', (id: number) => bookService.remove(id))
  handle('books:update-progress', (id: number, location: string, progress: number) =>
    bookService.updateProgress(id, location, progress)
  )
  handle('books:update-meta', (id: number, patch: never) => bookService.updateMeta(id, patch))
  handle('books:file', (id: number) => bookService.file(id))
  handle('books:text', (id: number) => bookService.text(id))
  handle('bookmarks:list', (bookId: number) => bookmarkService.list(bookId))
  handle('bookmarks:create', (input: never) => bookmarkService.create(input))
  handle('bookmarks:remove', (id: number) => bookmarkService.remove(id))
  handle('reader:settings', () => settingsService.getReaderSettings())
  handle('reader:set-settings', (value: never) => settingsService.setReaderSettings(value))
}