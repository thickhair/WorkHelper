/**
 * 阅读领域服务：书库（导入 / 移除 / 阅读进度 / 元数据）与书签的增删查。
 * 导入时把书籍文件复制到数据目录 books/ 子目录（原文件可自由移动 / 删除）；
 * 元数据（书名 / 作者 / 封面）由渲染层解析 EPUB / PDF 后经 books:update-meta 回写，
 * 解析失败时保留文件名作为书名、使用默认封面。
 */
import { dialog, type BrowserWindow } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, unlinkSync } from 'fs'
import { randomUUID } from 'crypto'
import { join } from 'path'
import { getBooksDir, getDb } from '../db/database'
import { READER_FORMATS, clampProgress, formatFromFileName, titleFromFileName } from '@shared/reader'
import type { Book, BookMetaPatch, Bookmark, BookmarkInput } from '@shared/types'

/** 单本文件大小上限（500MB） */
const MAX_FILE_SIZE = 500 * 1024 * 1024

/** 书签展示名长度上限 */
const MAX_LABEL_LENGTH = 80

/* ------------------------------ 行映射工具 ------------------------------ */

function mapBook(row: Record<string, unknown>): Book {
  return {
    id: Number(row.id),
    title: String(row.title),
    author: String(row.author ?? ''),
    format: String(row.format) as Book['format'],
    fileName: String(row.file_name),
    fileSize: Number(row.file_size ?? 0),
    cover: String(row.cover ?? ''),
    location: String(row.location ?? ''),
    progress: Number(row.progress ?? 0),
    lastReadAt: String(row.last_read_at ?? ''),
    createdAt: String(row.created_at ?? '')
  }
}

function mapBookmark(row: Record<string, unknown>): Bookmark {
  return {
    id: Number(row.id),
    bookId: Number(row.book_id),
    location: String(row.location ?? ''),
    label: String(row.label ?? ''),
    percent: Number(row.percent ?? 0),
    createdAt: String(row.created_at ?? '')
  }
}

/** 书籍文件的完整路径 */
function bookFilePath(fileName: string): string {
  return join(getBooksDir(), fileName)
}

/* -------------------------------- 书库 -------------------------------- */

export const bookService = {
  /** 书架列表：最近阅读在前，未读按导入时间倒序 */
  list(): Book[] {
    const rows = getDb()
      .prepare(
        `SELECT * FROM books
         ORDER BY CASE WHEN last_read_at = '' THEN 1 ELSE 0 END ASC,
                  last_read_at DESC, id DESC`
      )
      .all()
    return rows.map(mapBook)
  },

  get(id: number): Book | null {
    const row = getDb().prepare('SELECT * FROM books WHERE id = ?').get(id)
    return row ? mapBook(row) : null
  },

  /** 导入书籍：弹出文件选择框（多选），逐个复制入库，返回成功导入的书籍 */
  async import(win: BrowserWindow | null): Promise<Book[]> {
    const options = {
      title: '导入书籍',
      buttonLabel: '导入',
      properties: ['openFile', 'multiSelections'] as Array<'openFile' | 'multiSelections'>,
      filters: [{ name: '电子书', extensions: [...READER_FORMATS] }]
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return []

    const imported: Book[] = []
    for (const filePath of result.filePaths) {
      try {
        imported.push(this.importFile(filePath))
      } catch (err) {
        console.error('[reader] 导入失败：', filePath, err)
      }
    }
    if (imported.length === 0) {
      throw new Error('所选文件均无法导入（仅支持 EPUB / PDF / TXT / Markdown，且不超过 500MB）')
    }
    return imported
  },

  /** 单文件导入：校验格式与大小后复制到数据目录并写入记录 */
  importFile(sourcePath: string): Book {
    const format = formatFromFileName(sourcePath)
    if (!format) throw new Error('不支持的书籍格式（仅支持 EPUB / PDF / TXT / Markdown）')
    const size = statSync(sourcePath).size
    if (size <= 0) throw new Error('文件内容为空，无法导入')
    if (size > MAX_FILE_SIZE) throw new Error('文件超过 500MB，暂不支持导入')

    mkdirSync(getBooksDir(), { recursive: true })
    const fileName = `${randomUUID()}.${format}`
    copyFileSync(sourcePath, bookFilePath(fileName))

    const res = getDb()
      .prepare(
        `INSERT INTO books (title, author, format, file_name, file_size, cover, location, progress, last_read_at)
         VALUES (?, '', ?, ?, ?, '', '', 0, '')`
      )
      .run(titleFromFileName(sourcePath), format, fileName, size)
    return this.get(Number(res.lastInsertRowid))!
  },

  /** 移除书籍：删除记录（连同书签）与书籍文件 */
  remove(id: number): void {
    const book = this.get(id)
    if (!book) return
    const db = getDb()
    db.exec('BEGIN')
    try {
      db.prepare('DELETE FROM bookmarks WHERE book_id = ?').run(id)
      db.prepare('DELETE FROM books WHERE id = ?').run(id)
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
    try {
      const path = bookFilePath(book.fileName)
      if (existsSync(path)) unlinkSync(path)
    } catch (err) {
      console.error('[reader] 删除书籍文件失败：', err)
    }
  },

  /** 保存阅读进度与位置（打开书籍、翻页 / 跳转时调用） */
  updateProgress(id: number, location: string, progress: number): Book | null {
    getDb()
      .prepare(
        `UPDATE books
         SET location = ?, progress = ?, last_read_at = datetime('now','localtime')
         WHERE id = ?`
      )
      .run(String(location ?? ''), clampProgress(progress), id)
    return this.get(id)
  },

  /** 回写元数据（书名 / 作者 / 封面由渲染层解析后提交；字段缺失时保留原值） */
  updateMeta(id: number, patch: BookMetaPatch): Book | null {
    const book = this.get(id)
    if (!book) return null
    const title = typeof patch.title === 'string' ? patch.title.trim().slice(0, 200) : ''
    const author = typeof patch.author === 'string' ? patch.author.trim().slice(0, 120) : book.author
    const cover = typeof patch.cover === 'string' ? patch.cover : undefined
    getDb()
      .prepare('UPDATE books SET title = ?, author = ?, cover = ? WHERE id = ?')
      .run(title || book.title, author, cover === undefined ? book.cover : cover, id)
    return this.get(id)
  },

  /** 书籍原始内容（ArrayBuffer，供 EPUB / PDF 渲染引擎加载） */
  file(id: number): ArrayBuffer {
    const book = this.get(id)
    if (!book) throw new Error('书籍不存在')
    const path = bookFilePath(book.fileName)
    if (!existsSync(path)) {
      throw new Error('书籍文件不存在（可能已被移动或删除），请移除后重新导入')
    }
    const buffer = readFileSync(path)
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
  },

  /** 纯文本内容（TXT / Markdown 解码为字符串：优先 UTF-8，回退 GBK） */
  text(id: number): string {
    const book = this.get(id)
    if (!book) throw new Error('书籍不存在')
    if (book.format !== 'txt' && book.format !== 'md') throw new Error('该格式不支持文本读取')
    const path = bookFilePath(book.fileName)
    if (!existsSync(path)) {
      throw new Error('书籍文件不存在（可能已被移动或删除），请移除后重新导入')
    }
    const buffer = readFileSync(path)
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
    } catch {
      // 非 UTF-8（多为 GBK 编码的中文 TXT）回退 GBK 解码
      return new TextDecoder('gbk').decode(buffer)
    }
  }
}

/* -------------------------------- 书签 -------------------------------- */

export const bookmarkService = {
  /** 某本书的书签：按位置先后排列 */
  list(bookId: number): Bookmark[] {
    const rows = getDb()
      .prepare('SELECT * FROM bookmarks WHERE book_id = ? ORDER BY percent ASC, id ASC')
      .all(bookId)
    return rows.map(mapBookmark)
  },

  create(input: BookmarkInput): Bookmark {
    if (!bookService.get(input.bookId)) throw new Error('书籍不存在')
    const label = String(input.label ?? '')
      .trim()
      .slice(0, MAX_LABEL_LENGTH)
    const res = getDb()
      .prepare('INSERT INTO bookmarks (book_id, location, label, percent) VALUES (?, ?, ?, ?)')
      .run(input.bookId, String(input.location ?? ''), label, clampProgress(input.percent))
    const row = getDb()
      .prepare('SELECT * FROM bookmarks WHERE id = ?')
      .get(Number(res.lastInsertRowid))
    return mapBookmark(row as Record<string, unknown>)
  },

  remove(id: number): void {
    getDb().prepare('DELETE FROM bookmarks WHERE id = ?').run(id)
  }
}