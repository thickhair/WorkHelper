/**
 * PDF 阅读引擎：基于 pdfjs-dist（Apache-2.0）逐页渲染为画布，
 * 支持翻页、页码定位（书签）与随窗口宽度自适应缩放。
 * PDF 为固定版式，字体设置不生效，仅阅读区背景随配色主题变化。
 */
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { clampProgress } from '@shared/reader'
import { pdfjs } from './pdf-lib'
import type { ReaderEngine, ReaderEngineOptions, ReaderLocation, ReaderTocItem } from './types'

/** 创建 PDF 引擎（startLocation 为上次阅读页码） */
export function createPdfEngine(
  startLocation: string,
  data: ArrayBuffer,
  options: ReaderEngineOptions
): ReaderEngine {
  const toc: ReaderTocItem[] = []
  let doc: PDFDocumentProxy | null = null

  let page = 1
  let numPages = 0
  let destroyed = false
  let renderToken = 0
  let renderTask: { cancel: () => void; promise: Promise<unknown> } | null = null
  let resizeObserver: ResizeObserver | null = null
  let resizeTimer: ReturnType<typeof setTimeout> | null = null
  let last: ReaderLocation = { location: '1', percent: 0, label: '' }

  const viewport = document.createElement('div')
  viewport.className = 'pdf-viewport'
  viewport.style.cssText =
    'position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;display:flex;justify-content:center;padding:12px 0;'

  const canvas = document.createElement('canvas')
  canvas.className = 'pdf-canvas'
  canvas.style.cssText = 'display:block;margin:0 auto;box-shadow:0 2px 14px rgba(0,0,0,.12);border-radius:2px;'
  viewport.appendChild(canvas)
  options.container.appendChild(viewport)

  function emit(): void {
    const percent = numPages > 0 ? clampProgress((page / numPages) * 100) : 0
    last = {
      location: String(page),
      percent,
      label: `第 ${page} / ${numPages} 页`
    }
    options.onLocationChange({ ...last })
  }

  async function renderPage(resetScroll: boolean): Promise<void> {
    if (!doc || destroyed) return
    const token = ++renderToken
    try {
      renderTask?.cancel()
    } catch {
      /* 上一渲染任务可能已完成 */
    }
    const pdfPage = await doc.getPage(page)
    if (destroyed || token !== renderToken) return

    const base = pdfPage.getViewport({ scale: 1 })
    const available = Math.max(160, viewport.clientWidth - 24)
    const scale = available / base.width
    const size = pdfPage.getViewport({ scale })
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.floor(size.width * dpr)
    canvas.height = Math.floor(size.height * dpr)
    canvas.style.width = `${Math.floor(size.width)}px`
    canvas.style.height = `${Math.floor(size.height)}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const task = pdfPage.render({
      canvas,
      canvasContext: ctx,
      viewport: pdfPage.getViewport({ scale: scale * dpr })
    })
    renderTask = task
    try {
      await task.promise
    } catch {
      /* 渲染被取消（翻页过快）时忽略 */
    }
    renderTask = null
    if (destroyed || token !== renderToken) return
    if (resetScroll) viewport.scrollTop = 0
  }

  async function goPage(target: number, resetScroll = true): Promise<void> {
    const next = Math.min(numPages, Math.max(1, Math.trunc(target)))
    if (next === page && resetScroll === false) return
    page = next
    await renderPage(resetScroll)
    if (!destroyed) emit()
  }

  return {
    toc,

    async load(): Promise<void> {
      // pdf.js 会把数据转移到 Worker，传入副本避免影响调用方
      doc = await pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) }).promise
      numPages = doc.numPages
      const saved = Number(startLocation)
      page = Number.isFinite(saved) && saved >= 1 ? Math.min(numPages, Math.trunc(saved)) : 1
      viewport.style.background = options.palette.background
      await renderPage(true)
      emit()

      // 窗口 / 容器尺寸变化时重新适配宽度（保持当前页与滚动位置）
      resizeObserver = new ResizeObserver(() => {
        if (resizeTimer) clearTimeout(resizeTimer)
        resizeTimer = setTimeout(() => {
          void renderPage(false)
        }, 180)
      })
      resizeObserver.observe(options.container)
    },

    destroy(): void {
      destroyed = true
      renderToken += 1
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeObserver?.disconnect()
      resizeObserver = null
      try {
        renderTask?.cancel()
      } catch {
        /* 忽略 */
      }
      if (doc) void doc.loadingTask.destroy()
      doc = null
      viewport.remove()
    },

    next(): void {
      if (!doc || page >= numPages) return
      void goPage(page + 1)
    },

    prev(): void {
      if (!doc || page <= 1) return
      void goPage(page - 1)
    },

    goTo(location: string): void {
      if (!doc) return
      const target = Number(location)
      if (!Number.isFinite(target)) return
      void goPage(target)
    },

    goToPercent(percent: number): void {
      if (!doc) return
      const value = Math.min(100, Math.max(0, percent))
      void goPage(Math.max(1, Math.round((value / 100) * numPages)))
    },

    getLocation(): ReaderLocation {
      return { ...last }
    },

    applySettings(_settings, palette): void {
      viewport.style.background = palette.background
    }
  }
}