/**
 * 应用主进程入口：创建无边框窗口、初始化数据库、注册 IPC 处理器。
 */
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { closeDb, getDb } from './db/database'
import { setupDevCapture } from './dev-capture'
import { registerIpcHandlers } from './ipc'

let mainWindow: BrowserWindow | null = null

// 支持通过环境变量 WORKHELPER_DATA_DIR 指定数据目录（开发调试 / 便携模式）
const customDataDir = process.env['WORKHELPER_DATA_DIR']
if (customDataDir) {
  app.setPath('userData', customDataDir)
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 1080,
    minHeight: 680,
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
    app.setAppUserModelId('com.workhelper.desktop')
    // 提前初始化数据库，缩短首次操作等待时间
    getDb()
    registerIpcHandlers(() => mainWindow)
    createWindow()

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