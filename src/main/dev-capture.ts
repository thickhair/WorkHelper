/**
 * 开发调试模块：按环境变量 WORKHELPER_CAPTURE_DIR 指定的目录，
 * 依次切换路由并保存窗口截图（用于 UI 验证，不影响正常启动流程）。
 */
import { app, BrowserWindow } from 'electron'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

/** 需要截图的页面：名称 → 路由 hash */
const PAGES: Array<[string, string]> = [
  ['01-home', '/'],
  ['02-plan', '/plan'],
  ['03-module-fitness', '/m/fitness'],
  ['04-module-english', '/m/english'],
  ['05-news', '/news'],
  ['06-review', '/review'],
  ['07-stats', '/stats'],
  ['08-settings', '/settings'],
  ['09-plaza', '/plaza'],
  ['10-focus', '/focus']
]

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 若设置了截图目录，则在窗口加载完成后依次截图并退出 */
export function setupDevCapture(win: BrowserWindow): void {
  const dir = process.env['WORKHELPER_CAPTURE_DIR']
  if (!dir) return
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  // 关闭后台节流，保证被遮挡时动画与渲染正常推进（仅调试截图时启用）
  win.webContents.setBackgroundThrottling(false)

  win.webContents.on('did-finish-load', () => {
    void (async () => {
      try {
        win.showInactive()
        await delay(1200)
        for (const [name, hash] of PAGES) {
          await win.webContents.executeJavaScript(`window.location.hash = '#${hash}'`)
          await delay(2600)
          const image = await win.webContents.capturePage()
          writeFileSync(join(dir, `${name}.png`), image.toPNG())
          console.log(`[capture] 已保存 ${name}.png`)
        }
      } catch (err) {
        console.error('[capture] 截图失败：', err)
      } finally {
        console.log('CAPTURE_DONE')
        app.quit()
      }
    })()
  })
}