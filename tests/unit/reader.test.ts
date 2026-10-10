/**
 * 阅读模块共享纯函数测试：格式推断、书名生成、文件大小格式化、进度钳制、
 * 阅读设置规范化与阅读区配色解析。
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_READER_SETTINGS,
  READER_FONTS,
  clampProgress,
  fontStackOf,
  formatFileSize,
  formatFromFileName,
  normalizeReaderSettings,
  resolveReaderPalette,
  titleFromFileName
} from '@shared/reader'

describe('书籍格式与显示', () => {
  it('formatFromFileName 识别支持的扩展名（大小写不敏感），其余返回 null', () => {
    expect(formatFromFileName('novel.epub')).toBe('epub')
    expect(formatFromFileName('D:\\books\\A.PDF')).toBe('pdf')
    expect(formatFromFileName('notes.md')).toBe('md')
    expect(formatFromFileName('readme.txt')).toBe('txt')
    expect(formatFromFileName('book.mobi')).toBeNull()
    expect(formatFromFileName('noext')).toBeNull()
  })

  it('titleFromFileName 去除路径与扩展名，保留书名中的其他点号', () => {
    expect(titleFromFileName('D:\\books\\三体.epub')).toBe('三体')
    expect(titleFromFileName('/home/u/第 1 章.txt')).toBe('第 1 章')
    expect(titleFromFileName('a.b.c.md')).toBe('a.b.c')
    expect(titleFromFileName('.hidden')).toBe('.hidden')
  })

  it('formatFileSize 按 B / KB / MB / GB 展示', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(2048)).toBe('2.0 KB')
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(formatFileSize(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB')
  })

  it('clampProgress 取整并钳制到 0-100', () => {
    expect(clampProgress(42.4)).toBe(42)
    expect(clampProgress(-5)).toBe(0)
    expect(clampProgress(120)).toBe(100)
    expect(clampProgress(Number.NaN)).toBe(0)
  })
})

describe('阅读设置规范化', () => {
  it('默认值：系统字体 / 18px / 1.8 行距 / 64px 边距 / 跟随应用', () => {
    expect(normalizeReaderSettings(null)).toEqual(DEFAULT_READER_SETTINGS)
    expect(normalizeReaderSettings('bad-value')).toEqual(DEFAULT_READER_SETTINGS)
  })

  it('非法字体与主题回退默认，数值越界钳制到允许区间', () => {
    const result = normalizeReaderSettings({
      fontId: 'bad',
      fontSize: 100,
      lineHeight: 0.1,
      margin: -3,
      theme: 'rainbow'
    })
    expect(result.fontId).toBe('system')
    expect(result.fontSize).toBe(30)
    expect(result.lineHeight).toBe(1.4)
    expect(result.margin).toBe(24)
    expect(result.theme).toBe('auto')
  })

  it('行距保留一位小数，字号与边距取整', () => {
    const result = normalizeReaderSettings({
      fontId: 'kai',
      fontSize: 21.6,
      lineHeight: 1.83,
      margin: 70.4,
      theme: 'dark'
    })
    expect(result.fontId).toBe('kai')
    expect(result.fontSize).toBe(22)
    expect(result.lineHeight).toBe(1.8)
    expect(result.margin).toBe(70)
    expect(result.theme).toBe('dark')
  })

  it('fontStackOf 未知字体回退系统默认字体栈', () => {
    expect(fontStackOf('song')).toContain('SimSun')
    expect(fontStackOf('unknown')).toBe(READER_FONTS[0].stack)
  })
})

describe('阅读区配色', () => {
  it('auto 跟随应用主题深浅：深色应用使用夜间配色', () => {
    expect(resolveReaderPalette('auto', false).background).toBe('#FFFFFF')
    expect(resolveReaderPalette('auto', true).background).toBe('#17191D')
    expect(resolveReaderPalette('auto', true).dark).toBe(true)
    expect(resolveReaderPalette('auto', false).dark).toBe(false)
  })

  it('显式主题忽略应用主题', () => {
    expect(resolveReaderPalette('sepia', false).background).toBe('#F7F1E1')
    expect(resolveReaderPalette('light', true).background).toBe('#FFFFFF')
    expect(resolveReaderPalette('dark', false).dark).toBe(true)
  })
})