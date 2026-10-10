/**
 * 开发调试模块：按环境变量 WORKBENCH_CAPTURE_DIR 指定的目录，
 * 依次切换路由并保存窗口截图（用于 UI 验证，不影响正常启动流程）。
 * 额外页面可由 WORKBENCH_CAPTURE_EXTRA 指定（JSON 数组：
 * [名称, 路由 hash] 或 [名称, 路由 hash, 截图前执行的脚本]，如打开阅读面板）。
 */
import { app, BrowserWindow } from 'electron'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

/** 需要截图的页面：名称 → 路由 hash */
const PAGES: Array<[string, string]> = [
  ['01-home', '/'],
  ['02-calendar', '/calendar'],
  ['03-assets', '/assets'],
  ['04-plaza', '/plaza'],
  ['05-settings', '/settings']
]

/** 追加页面：[名称, 路由 hash, 截图前执行的脚本（可选）] */
type CapturePage = [string, string, string?]

/** 解析 WORKBENCH_CAPTURE_EXTRA（格式非法时忽略并输出警告） */
function extraPages(): CapturePage[] {
  const raw = process.env['WORKBENCH_CAPTURE_EXTRA']
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item) => Array.isArray(item) && item.length >= 2)
      .map((item) => {
        const entry = item as unknown[]
        return [
          String(entry[0]),
          String(entry[1]),
          entry[2] === undefined ? undefined : String(entry[2])
        ] as CapturePage
      })
  } catch (err) {
    console.error('[capture] WORKBENCH_CAPTURE_EXTRA 解析失败：', err)
    return []
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 阅读页就绪等待：轮询至加载遮罩消失且阅读内容（文本流 / iframe / PDF 画布）已渲染 */
async function waitReaderReady(win: BrowserWindow): Promise<void> {
  for (let i = 0; i < 30; i++) {
    try {
      const ready = (await win.webContents.executeJavaScript(
        "(() => { const overlay = document.querySelector('.reader-overlay'); const stage = document.querySelector('.reader-stage');" +
          " const content = stage && (stage.querySelector('.text-flow') || stage.querySelector('iframe') || stage.querySelector('.pdf-canvas'));" +
          ' return Boolean(content) && !overlay })()'
      )) as boolean
      if (ready) return
    } catch {
      /* 页面切换瞬间执行失败时继续轮询 */
    }
    await delay(300)
  }
}

/** 若设置了截图目录，则在窗口加载完成后依次截图并退出 */
export function setupDevCapture(win: BrowserWindow): void {
  const dir = process.env['WORKBENCH_CAPTURE_DIR']
  if (!dir) return
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  // 关闭后台节流，保证被遮挡时动画与渲染正常推进（仅调试截图时启用）
  win.webContents.setBackgroundThrottling(false)

  win.webContents.on('did-finish-load', () => {
    void (async () => {
      try {
        win.showInactive()
        // 非激活窗口下合成器驱动的 CSS 过渡可能停滞（截图会抓到半透明中间态），
        // 截图模式下禁用过渡与动画，保证每页截到最终状态
        await win.webContents.insertCSS(
          '*, *::before, *::after { transition: none !important; animation: none !important; }'
        )
        await delay(1200)
        const pages: CapturePage[] = [...PAGES, ...extraPages()]
        for (const [name, hash, preScript] of pages) {
          await win.webContents.executeJavaScript(`window.location.hash = '#${hash}'`)
          if (hash.startsWith('/reader/book')) {
            // 阅读页需等待引擎就绪（EPUB / PDF 异步解析渲染），再留出排版稳定时间
            await waitReaderReady(win)
            await delay(800)
          } else {
            await delay(2600)
          }
          if (preScript) {
            try {
              await win.webContents.executeJavaScript(preScript)
              await delay(800)
            } catch (err) {
              console.error(`[capture] ${name} 截图前脚本执行失败：`, err)
            }
          }
          const image = await win.webContents.capturePage()
          writeFileSync(join(dir, `${name}.png`), image.toPNG())
          console.log(`[capture] 已保存 ${name}.png`)
          // 页面长于视口时补拍一张滚动到底部的截图（核对首屏之外的区块，如日历数据看板）
          const overflow = (await win.webContents.executeJavaScript(
            "(() => { const el = document.querySelector('.app-content'); return el ? el.scrollHeight - el.clientHeight : 0 })()"
          )) as number
          if (overflow > 8) {
            await win.webContents.executeJavaScript(
              "document.querySelector('.app-content').scrollTo(0, 999999)"
            )
            await delay(700)
            const bottom = await win.webContents.capturePage()
            writeFileSync(join(dir, `${name}-bottom.png`), bottom.toPNG())
            console.log(`[capture] 已保存 ${name}-bottom.png`)
          }
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