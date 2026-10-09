/**
 * 应用主进程入口：创建无边框窗口、初始化数据库、注册 IPC 处理器。
 */
import { app, BrowserWindow, Notification, shell } from 'electron'
import { join } from 'path'
import { birthdayDateLabel } from '@shared/calendar'
import { formatDate } from '@shared/logic'
import { closeDb, getDb } from './db/database'
import { setupDevCapture } from './dev-capture'
import { registerIpcHandlers } from './ipc'
import { birthdayService } from './services/birthday.service'
import { storageService } from './services/storage.service'
import { weatherService } from './services/weather.service'

let mainWindow: BrowserWindow | null = null

// 支持通过环境变量 WORKBENCH_DATA_DIR 指定数据目录（开发调试 / 便携模式）
const customDataDir = process.env['WORKBENCH_DATA_DIR']
if (customDataDir) {
  app.setPath('userData', customDataDir)
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 900,
    // 最小尺寸放宽：窄窗口下侧边栏会自动收起为图标（见 AppSidebar.vue）
    minWidth: 480,
    minHeight: 460,
    show: false,
    frame: false,
    backgroundColor: '#F3F7F3',
    title: '个人工作台',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  })

  // 首帧渲染完成后再显示窗口，避免白屏闪烁
  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // 最大化状态变化时通知渲染进程更新按钮图标
  const sendMaximized = (): void => {
    mainWindow?.webContents.send('window:maximized-changed', mainWindow.isMaximized())
  }
  mainWindow.on('maximize', sendMaximized)
  mainWindow.on('unmaximize', sendMaximized)
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // 禁止应用内直接打开新窗口，外链交由系统浏览器处理
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  // 将渲染进程日志转发到主进程输出，便于排查问题
  mainWindow.webContents.on('console-message', (...args: unknown[]) => {
    const first = args[0] as { message?: string } | undefined
    if (first && typeof first === 'object' && 'message' in first) {
      console.log('[renderer]', first.message)
    } else if (typeof args[0] === 'string') {
      console.log('[renderer]', args[2] ?? args[0])
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // 开发调试：按需自动截图各个页面
  setupDevCapture(mainWindow)
}

/**
 * 生日提醒：应用运行期间定期检查（启动时 + 每 30 分钟），
 * 命中「提前提醒天数」窗口时弹出系统通知（同一天同一生日只提醒一次）。
 */
function setupBirthdayReminders(): void {
  let notifiedDate = ''
  const notifiedIds = new Set<number>()

  const check = (): void => {
    try {
      const today = formatDate(new Date())
      if (today !== notifiedDate) {
        notifiedDate = today
        notifiedIds.clear()
      }
      if (!Notification.isSupported()) return
      for (const item of birthdayService.upcoming(0, today)) {
        if (item.daysUntil > item.birthday.remindDays) continue
        if (notifiedIds.has(item.birthday.id)) continue
        notifiedIds.add(item.birthday.id)
        const label = birthdayDateLabel(item.birthday)
        const body =
          item.daysUntil === 0
            ? `今天是 ${item.birthday.name} 的生日（${label}）`
            : `还有 ${item.daysUntil} 天是 ${item.birthday.name} 的生日（${label}）`
        new Notification({ title: '生日提醒', body }).show()
      }
    } catch (err) {
      console.error('[birthday] 生日提醒检查失败：', err)
    }
  }

  check()
  setInterval(check, 30 * 60 * 1000)
}

// 单实例锁：重复启动时聚焦已有窗口
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    app.setAppUserModelId('com.workbench.desktop')
    // 应用设置中保存的数据存储位置（如已更改），再初始化数据库
    storageService.init()
    // 提前初始化数据库，缩短首次操作等待时间
    getDb()
    registerIpcHandlers(() => mainWindow)
    createWindow()
    setupBirthdayReminders()
    // 预取天气（后台执行，失败不影响启动），日历页打开时可直接使用缓存
    void weatherService.report().catch(() => undefined)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('will-quit', () => {
    closeDb()
  })
}