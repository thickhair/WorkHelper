/**
 * 新闻资讯服务：本地资讯条目的录入、收藏、搜索与删除。
 */
import { getDb } from '../db/database'
import type { NewsInput, NewsItem } from '@shared/types'

function mapNews(row: Record<string, unknown>): NewsItem {
  return {
    id: Number(row.id),
    title: String(row.title),
    source: String(row.source ?? ''),
    url: String(row.url ?? ''),
    summary: String(row.summary ?? ''),
    tags: String(row.tags ?? ''),
    favorite: Number(row.favorite) === 1,
    createdAt: String(row.created_at ?? '')
  }
}

export const newsService = {
  /** 查询资讯：keyword 模糊匹配标题/来源/摘要，favoriteOnly 仅看收藏 */
  list(keyword = '', favoriteOnly = false): NewsItem[] {
    const db = getDb()
    const conditions: string[] = []
    const params: unknown[] = []
    if (keyword.trim()) {
      conditions.push('(title LIKE ? OR source LIKE ? OR summary LIKE ? OR tags LIKE ?)')
      const like = `%${keyword.trim()}%`
      params.push(like, like, like, like)
    }
    if (favoriteOnly) conditions.push('favorite = 1')
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const rows = db
      .prepare(`SELECT * FROM news ${where} ORDER BY favorite DESC, id DESC LIMIT 500`)
      .all(...params)
    return rows.map(mapNews)
  },

  create(input: NewsInput): NewsItem {
    const res = getDb()
      .prepare(
        'INSERT INTO news (title, source, url, summary, tags, favorite) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(
        input.title.trim(),
        input.source ?? '',
        input.url ?? '',
        input.summary ?? '',
        input.tags ?? '',
        input.favorite ? 1 : 0
      )
    return this.get(Number(res.lastInsertRowid))!
  },

  get(id: number): NewsItem | null {
    const row = getDb().prepare('SELECT * FROM news WHERE id = ?').get(id)
    return row ? mapNews(row) : null
  },

  update(id: number, patch: Partial<NewsInput>): NewsItem | null {
    const current = this.get(id)
    if (!current) return null
    const next = { ...current, ...patch }
    getDb()
      .prepare(
        'UPDATE news SET title = ?, source = ?, url = ?, summary = ?, tags = ?, favorite = ? WHERE id = ?'
      )
      .run(
        next.title.trim(),
        next.source ?? '',
        next.url ?? '',
        next.summary ?? '',
        next.tags ?? '',
        next.favorite ? 1 : 0,
        id
      )
    return this.get(id)
  },

  toggleFavorite(id: number): NewsItem | null {
    const current = this.get(id)
    if (!current) return null
    getDb().prepare('UPDATE news SET favorite = ? WHERE id = ?').run(current.favorite ? 0 : 1, id)
    return this.get(id)
  },

  remove(id: number): void {
    getDb().prepare('DELETE FROM news WHERE id = ?').run(id)
  }
}