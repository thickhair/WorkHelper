/**
 * EPUB 阅读引擎：基于 epubjs（BSD-2-Clause）实现分页渲染、章节目录、
 * CFI 精确定位（阅读进度与书签）与字体 / 配色实时注入。
 */
import ePub from 'epubjs'
import type { Book as EpubBook, Contents, NavItem, Rendition } from 'epubjs'
import { clampProgress } from '@shared/reader'
import { readerContentCss } from './style'
import type { ReaderEngine, ReaderEngineOptions, ReaderLocation, ReaderTocItem } from './types'

/** 将 epubjs 目录树拍平为带层级的条目 */
function flattenToc(items: NavItem[], level: number, out: ReaderTocItem[]): void {
  items.forEach((item, index) => {
    if (!item?.href) return
    out.push({
      id: `${level}-${index}-${item.href}`,
      label: String(item.label ?? '').trim() || item.href,
      level,
      target: item.href
    })
    if (item.subitems?.length) flattenToc(item.subitems, level + 1, out)
  })
}

/** 章节 href 匹配（忽略锚点与编码差异） */
function hrefMatches(target: string, href: string): boolean {
  const clean = (value: string): string => {
    try {
      return decodeURIComponent(value.split('#')[0]).replace(/^\.\//, '')
    } catch {
      return value.split('#')[0]
    }
  }
  return clean(target) === clean(href)
}

/** 安全调用可能返回 Promise 的渲染操作（忽略边界处的中止 / 异常） */
function safe(p: unknown): void {
  if (p && typeof (p as Promise<unknown>).catch === 'function') {
    ;(p as Promise<unknown>).catch(() => undefined)
  }
}

/**
 * 创建 EPUB 引擎。
 * @param startLocation 上次阅读位置（CFI，空串表示从头开始）
 * @param data 书籍原始内容
 */
export function createEpubEngine(
  startLocation: string,
  data: ArrayBuffer,
  options: ReaderEngineOptions
): ReaderEngine {
  const toc: ReaderTocItem[] = []
  let book: EpubBook | null = null
  let rendition: Rendition | null = null
  let locationsReady = false
  let spineCount = 1
  let destroyed = false
  let settings = options.settings
  let palette = options.palette
  let last: ReaderLocation = { location: '', percent: 0, label: '' }

  /** 向内嵌文档注入 / 刷新阅读样式（固定 key：同一文档内替换而不是重复堆积） */
  function applyContentTheme(contents: Contents): void {
    contents.addStylesheetCss(readerContentCss(settings, palette), 'workbench-reader-theme')
  }

  /** 当前章节名（目录中精确匹配；未命中返回空串） */
  function chapterLabel(href: string): string {
    const hit = toc.find((item) => hrefMatches(item.target, href))
    return hit?.label ?? ''
  }

  /** 汇总位置信息并通知阅读页（CFI 优先，未生成位置索引时按章节比例回退） */
  function emit(cfi: string, spineIndex: number, href: string): void {
    let percent = 0
    if (locationsReady && book) {
      try {
        percent = clampProgress(book.locations.percentageFromCfi(cfi) * 100)
      } catch {
        percent = 0
      }
    } else if (spineCount > 1) {
      percent = clampProgress((spineIndex / (spineCount - 1)) * 100)
    }
    const chapter = chapterLabel(href)
    last = {
      location: cfi,
      percent,
      label: chapter || `位置 ${percent}%`
    }
    options.onLocationChange({ ...last })
  }

  return {
    toc,

    async load(): Promise<void> {
      book = ePub(data)
      await book.ready
      try {
        const nav = await book.loaded.navigation
        flattenToc((nav?.toc ?? []) as NavItem[], 0, toc)
      } catch {
        /* 无导航文档的 EPUB：目录留空 */
      }
      try {
        book.spine.each((_section: unknown, index: number) => {
          spineCount = Math.max(spineCount, index + 1)
        })
      } catch {
        spineCount = 1
      }

      rendition = book.renderTo(options.container, {
        width: '100%',
        height: '100%',
        flow: 'paginated',
        spread: 'none',
        allowScriptedContent: false
      })
      // epubjs 内建 themes 不会把 registerCss（serialized 类型）主题注入新渲染的内嵌文档，
      // 因此在内容钩子上自行注入，保证每个章节都应用字体 / 配色（深色主题不再漏注入）。
      rendition.hooks.content.register((contents: Contents) => {
        applyContentTheme(contents)
      })
      rendition.on('relocated', (loc: unknown) => {
        const start = (loc as { start?: { cfi?: string; index?: number; href?: string } }).start
        if (!start?.cfi) return
        emit(start.cfi, Number(start.index ?? 0), String(start.href ?? ''))
      })

      try {
        await rendition.display(startLocation || undefined)
      } catch {
        await rendition.display()
      }

      // 后台生成位置索引（大文件较慢）：完成后以更精细的百分比刷新进度
      void book.locations
        .generate(1600)
        .then(() => {
          locationsReady = true
          if (!destroyed && last.location && book) {
            try {
              const percent = clampProgress(book.locations.percentageFromCfi(last.location) * 100)
              last = {
                ...last,
                percent,
                label: last.label.startsWith('位置 ') ? `位置 ${percent}%` : last.label
              }
              options.onLocationChange({ ...last })
            } catch {
              /* 忽略无效 CFI */
            }
          }
        })
        .catch(() => undefined)
    },

    destroy(): void {
      destroyed = true
      try {
        rendition?.destroy()
      } catch {
        /* 忽略销毁异常 */
      }
      try {
        book?.destroy()
      } catch {
        /* 忽略销毁异常 */
      }
      rendition = null
      book = null
    },

    next(): void {
      safe(rendition?.next())
    },

    prev(): void {
      safe(rendition?.prev())
    },

    goTo(location: string): void {
      if (!rendition) return
      const target = location?.trim()
      if (!target) return
      safe(rendition.display(target))
    },

    goToPercent(percent: number): void {
      if (!rendition || !book) return
      const value = Math.min(100, Math.max(0, percent))
      if (locationsReady) {
        try {
          safe(rendition.display(book.locations.cfiFromPercentage(value / 100)))
          return
        } catch {
          /* 回退到按章节近似 */
        }
      }
      const index = Math.min(spineCount - 1, Math.max(0, Math.round((value / 100) * (spineCount - 1))))
      const section = book.spine.get(index) as { href?: string } | null
      if (section?.href) safe(rendition.display(section.href))
    },

    getLocation(): ReaderLocation {
      return { ...last }
    },

    applySettings(next, nextPalette): void {
      settings = next
      palette = nextPalette
      const contents = rendition?.getContents() as unknown as Contents[] | undefined
      contents?.forEach((content) => applyContentTheme(content))
    }
  }
}