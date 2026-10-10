/**
 * 书籍元数据解析：导入 EPUB / PDF 后在渲染层解析书名、作者与封面并回写数据库。
 * 解析失败返回 null（不影响导入：保留文件名书名与默认封面）。
 */
import ePub from 'epubjs'
import type { Book, BookMetaPatch } from '@shared/types'
import { pdfjs } from './pdf-lib'

/** 图片压缩为最长边 400px 的 JPEG dataURL（控制数据库体积） */
async function imageToCoverDataUrl(source: Blob): Promise<string> {
  const bitmap = await createImageBitmap(source)
  try {
    const maxSide = 400
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.82)
  } finally {
    bitmap.close()
  }
}

async function parseEpubMeta(data: ArrayBuffer): Promise<BookMetaPatch> {
  const book = ePub(data)
  try {
    await book.ready
    const meta = (await book.loaded.metadata) as { title?: string; creator?: string } | undefined
    const patch: BookMetaPatch = {}
    if (meta?.title) patch.title = String(meta.title).trim()
    if (meta?.creator) patch.author = String(meta.creator).trim()
    const coverUrl = await book.coverUrl()
    if (coverUrl) {
      const blob = await (await fetch(coverUrl)).blob()
      const cover = await imageToCoverDataUrl(blob)
      if (cover) patch.cover = cover
    }
    return patch
  } finally {
    book.destroy()
  }
}

async function parsePdfMeta(data: ArrayBuffer): Promise<BookMetaPatch> {
  // pdf.js 会把数据转移到 Worker，传入副本避免影响调用方
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) }).promise
  try {
    const patch: BookMetaPatch = {}
    try {
      const meta = await doc.getMetadata()
      const info = meta.info as { Title?: string; Author?: string }
      if (info?.Title) patch.title = String(info.Title).trim()
      if (info?.Author) patch.author = String(info.Author).trim()
    } catch {
      /* PDF 可无元数据 */
    }
    const page = await doc.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const scale = 320 / base.width
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(viewport.width))
    canvas.height = Math.max(1, Math.round(viewport.height))
    const ctx = canvas.getContext('2d')
    if (ctx) {
      await page.render({ canvas, canvasContext: ctx, viewport }).promise
      patch.cover = canvas.toDataURL('image/jpeg', 0.8)
    }
    return patch
  } finally {
    void doc.loadingTask.destroy()
  }
}

/** 解析书籍元数据（仅 EPUB / PDF 支持；失败返回 null） */
export async function parseBookMeta(record: Book, data: ArrayBuffer): Promise<BookMetaPatch | null> {
  try {
    if (record.format === 'epub') return await parseEpubMeta(data)
    if (record.format === 'pdf') return await parsePdfMeta(data)
    return null
  } catch (err) {
    console.warn('[reader] 元数据解析失败：', record.title, err)
    return null
  }
}