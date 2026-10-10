/**
 * 文本阅读引擎（TXT / Markdown）：HTML 内容装入 CSS 多栏分页容器，
 * 通过水平位移翻页，支持字体 / 字号 / 行距 / 页边距实时调整与百分比定位。
 * TXT 按行分段并转义；Markdown 由 marked 渲染并经 DOMPurify 净化后展示。
 */
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { clampProgress } from '@shared/reader'
import { applyTextFlowStyle } from './style'
import type { ReaderEngine, ReaderEngineOptions, ReaderLocation, ReaderTocItem } from './types'

/** TXT 转 HTML：每行一个段落（中文小说常见一行一段），转义 HTML 特殊字符 */
function textToHtml(text: string): string {
  const escapeHtml = (value: string): string =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => `<p>${escapeHtml(line.replace(/\s+$/, ''))}</p>`)
    .join('')
}

/** Markdown 转 HTML（净化防止内联脚本 / 事件属性执行） */
function markdownToHtml(text: string): string {
  const raw = marked.parse(text) as string
  return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } })
}

/**
 * 创建文本引擎。
 * @param startLocation 上次阅读位置（百分比字符串）
 * @param text 解码后的文本内容
 * @param format 源格式（txt / md，决定渲染方式）
 */
export function createTextEngine(
  startLocation: string,
  text: string,
  format: 'txt' | 'md',
  options: ReaderEngineOptions
): ReaderEngine {
  const toc: ReaderTocItem[] = []
  let settings = options.settings
  let destroyed = false
  let pages = 1
  let page = 0
  let pageWidth = 0
  let resizeObserver: ResizeObserver | null = null
  let resizeTimer: ReturnType<typeof setTimeout> | null = null
  let last: ReaderLocation = { location: '0', percent: 0, label: '第 1 / 1 页' }

  const flow = document.createElement('div')
  flow.className = 'text-flow'
  flow.innerHTML = format === 'md' ? markdownToHtml(text) : textToHtml(text)
  options.container.appendChild(flow)

  function percentOf(): number {
    return pages > 1 ? clampProgress(((page + 1) / pages) * 100) : 100
  }

  function pageFromPercent(percent: number): number {
    const value = Math.min(100, Math.max(0, percent))
    if (pages <= 1) return 0
    return Math.min(pages - 1, Math.max(0, Math.round((value / 100) * pages - 1)))
  }

  function emit(): void {
    const percent = percentOf()
    last = {
      location: String(percent),
      percent,
      label: `第 ${page + 1} / ${pages} 页`
    }
    options.onLocationChange({ ...last })
  }

  /** 依据容器尺寸与页边距重排多栏布局，并统计总页数 */
  function reflow(): void {
    const width = options.container.clientWidth
    const height = options.container.clientHeight
    if (width <= 0 || height <= 0) return
    // 页边距不超过容器宽度的 1/4，保障窄窗口下可读
    const margin = Math.min(settings.margin, Math.max(12, Math.floor(width / 4)))
    const colWidth = Math.max(60, width - margin * 2)
    const gap = margin * 2
    flow.style.width = `${width}px`
    flow.style.height = `${height}px`
    flow.style.columnWidth = `${colWidth}px`
    flow.style.columnGap = `${gap}px`
    pageWidth = width
    // 多栏容器 scrollWidth = 页数 × 栏宽 + (页数 - 1) × 栏间距
    pages = Math.max(1, Math.round((flow.scrollWidth + gap) / (colWidth + gap)))
    page = Math.min(page, pages - 1)
    applyTransform()
  }

  function applyTransform(): void {
    flow.style.transform = `translateX(${-page * pageWidth}px)`
  }

  return {
    toc,

    async load(): Promise<void> {
      applyTextFlowStyle(flow, settings, options.palette)
      try {
        // 等待字体就绪后再测量，避免首屏分页误差
        await document.fonts?.ready
      } catch {
        /* 忽略字体加载异常 */
      }
      if (destroyed) return
      const saved = Number(startLocation)
      reflow()
      if (Number.isFinite(saved) && saved > 0) {
        page = pageFromPercent(saved)
        applyTransform()
      }
      emit()

      resizeObserver = new ResizeObserver(() => {
        if (resizeTimer) clearTimeout(resizeTimer)
        resizeTimer = setTimeout(() => {
          if (destroyed) return
          const percent = percentOf()
          reflow()
          page = pageFromPercent(percent)
          applyTransform()
          emit()
        }, 180)
      })
      resizeObserver.observe(options.container)
    },

    destroy(): void {
      destroyed = true
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeObserver?.disconnect()
      resizeObserver = null
      flow.remove()
    },

    next(): void {
      if (page >= pages - 1) return
      page += 1
      applyTransform()
      emit()
    },

    prev(): void {
      if (page <= 0) return
      page -= 1
      applyTransform()
      emit()
    },

    goTo(location: string): void {
      const target = Number(location)
      if (!Number.isFinite(target)) return
      page = pageFromPercent(target)
      applyTransform()
      emit()
    },

    goToPercent(percent: number): void {
      page = pageFromPercent(percent)
      applyTransform()
      emit()
    },

    getLocation(): ReaderLocation {
      return { ...last }
    },

    applySettings(next, palette): void {
      settings = next
      applyTextFlowStyle(flow, next, palette)
      const percent = percentOf()
      reflow()
      page = pageFromPercent(percent)
      applyTransform()
      emit()
    }
  }
}