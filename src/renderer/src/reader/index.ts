/**
 * 阅读引擎入口：按书籍格式创建对应引擎（EPUB / PDF / 文本）。
 * 阅读页（ReaderView）只依赖本模块，便于单元测试替换。
 */
import type { Book } from '@shared/types'
import { createEpubEngine } from './epub-engine'
import { createPdfEngine } from './pdf-engine'
import { createTextEngine } from './text-engine'
import type { ReaderEngine, ReaderEngineOptions } from './types'

export type {
  ReaderEngine,
  ReaderEngineOptions,
  ReaderLocation,
  ReaderTocItem
} from './types'

/**
 * 创建阅读引擎。
 * @param record 书籍记录（使用其中的格式与上次阅读位置）
 * @param data EPUB / PDF 为 ArrayBuffer；TXT / Markdown 为解码后的字符串
 * @param runtime 容器、阅读设置、配色与位置变化回调
 * 调用方负责 load() 与 destroy()。
 */
export function createReaderEngine(
  record: Book,
  data: ArrayBuffer | string,
  runtime: ReaderEngineOptions
): ReaderEngine {
  const startLocation = record.location ?? ''
  if (record.format === 'epub') {
    return createEpubEngine(startLocation, data as ArrayBuffer, runtime)
  }
  if (record.format === 'pdf') {
    return createPdfEngine(startLocation, data as ArrayBuffer, runtime)
  }
  return createTextEngine(startLocation, data as string, record.format === 'md' ? 'md' : 'txt', runtime)
}