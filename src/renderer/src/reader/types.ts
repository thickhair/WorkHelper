/**
 * 阅读引擎统一接口：EPUB（epubjs）/ PDF（pdfjs-dist）/ 文本（TXT / Markdown 分页流）
 * 三种实现共享同一套外部契约，阅读页（ReaderView）不感知具体格式。
 */
import type { ReaderPalette, ReaderSettings } from '@shared/reader'

/** 阅读位置（保存进度与书签的统一结构） */
export interface ReaderLocation {
  /** 定位串：EPUB 为 CFI，PDF 为页码，文本为百分比（0-100） */
  location: string
  /** 位置百分比 0-100 */
  percent: number
  /** 展示名（章节名 / 页码 / 位置百分比） */
  label: string
}

/** 目录条目（仅 EPUB 提供） */
export interface ReaderTocItem {
  id: string
  label: string
  /** 层级（从 0 开始） */
  level: number
  /** 跳转目标（EPUB 为章节 href） */
  target: string
}

/** 引擎运行时参数 */
export interface ReaderEngineOptions {
  /** 引擎挂载容器（须有确定尺寸） */
  container: HTMLElement
  settings: ReaderSettings
  palette: ReaderPalette
  /** 位置变化回调（翻页 / 跳转 / 重排后触发，用于保存进度与刷新展示） */
  onLocationChange: (location: ReaderLocation) => void
}

/** 阅读引擎接口 */
export interface ReaderEngine {
  /** 目录（非 EPUB 格式为空数组） */
  readonly toc: ReaderTocItem[]
  load(): Promise<void>
  destroy(): void
  next(): void
  prev(): void
  /** 跳转到保存的位置（恢复进度 / 目录与书签跳转） */
  goTo(location: string): void
  /** 按百分比跳转（进度条拖动） */
  goToPercent(percent: number): void
  /** 当前阅读位置 */
  getLocation(): ReaderLocation
  /** 应用阅读设置与配色（实时生效） */
  applySettings(settings: ReaderSettings, palette: ReaderPalette): void
}