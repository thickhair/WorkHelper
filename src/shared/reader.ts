/**
 * 阅读模块共享纯函数：书籍格式推断、显示格式化、阅读设置规范化与阅读区配色解析。
 * 供主进程（导入校验 / 服务层）与渲染层（书架 / 阅读器）共用，不依赖 Electron 与 DOM。
 */

/** 支持的书籍格式 */
export type ReaderFormat = 'epub' | 'pdf' | 'txt' | 'md'

/** 支持的格式列表（导入校验与文件选择框共用） */
export const READER_FORMATS: ReaderFormat[] = ['epub', 'pdf', 'txt', 'md']

/** 格式显示名 */
export const READER_FORMAT_LABELS: Record<ReaderFormat, string> = {
  epub: 'EPUB',
  pdf: 'PDF',
  txt: 'TXT',
  md: 'Markdown'
}

/** 从文件名（或完整路径）推断书籍格式；不支持的扩展名返回 null */
export function formatFromFileName(name: string): ReaderFormat | null {
  const dot = name.lastIndexOf('.')
  if (dot < 0) return null
  const ext = name.slice(dot + 1).toLowerCase()
  return (READER_FORMATS as string[]).includes(ext) ? (ext as ReaderFormat) : null
}

/** 从文件名（或完整路径）生成默认书名：去除路径与扩展名 */
export function titleFromFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name
  const dot = base.lastIndexOf('.')
  const title = (dot > 0 ? base.slice(0, dot) : base).trim()
  return title || base
}

/** 文件大小显示（B / KB / MB / GB） */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${index === 0 || value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[index]}`
}

/** 阅读进度（0-100）取整与钳制 */
export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}

/* ------------------------------ 阅读设置 ------------------------------ */

/** 阅读字体候选（Windows 常见中文字体，EPUB 内嵌文档同样可用） */
export interface ReaderFontOption {
  id: string
  name: string
  /** CSS font-family 字体栈 */
  stack: string
}

export const READER_FONTS: ReaderFontOption[] = [
  {
    id: 'system',
    name: '系统默认',
    stack: "'Microsoft YaHei UI', 'Microsoft YaHei', 'Segoe UI', 'PingFang SC', sans-serif"
  },
  { id: 'song', name: '宋体', stack: "SimSun, 'Songti SC', 'Noto Serif SC', serif" },
  { id: 'kai', name: '楷体', stack: "KaiTi, 'Kaiti SC', 'STKaiti', serif" },
  { id: 'hei', name: '黑体', stack: "SimHei, 'Heiti SC', 'Noto Sans SC', sans-serif" },
  { id: 'fangsong', name: '仿宋', stack: "FangSong, 'STFangsong', serif" }
]

/** 阅读主题（阅读区配色，与应用外观主题独立） */
export type ReaderTheme = 'auto' | 'light' | 'sepia' | 'dark'

export const READER_THEMES: Array<{ id: ReaderTheme; name: string }> = [
  { id: 'auto', name: '跟随应用' },
  { id: 'light', name: '浅色' },
  { id: 'sepia', name: '羊皮纸' },
  { id: 'dark', name: '夜间' }
]

/** 阅读设置（字体 / 字号 / 行距 / 页边距 / 配色主题） */
export interface ReaderSettings {
  /** 字体 id（见 READER_FONTS） */
  fontId: string
  /** 字号（px） */
  fontSize: number
  /** 行距倍数 */
  lineHeight: number
  /** 阅读区左右页边距（px） */
  margin: number
  theme: ReaderTheme
}

/** 各设置项的允许区间（设置面板步进器与规范化共用） */
export const READER_FONT_SIZE_RANGE = { min: 14, max: 30, step: 1 } as const
export const READER_LINE_HEIGHT_RANGE = { min: 1.4, max: 2.4, step: 0.1 } as const
export const READER_MARGIN_RANGE = { min: 24, max: 96, step: 8 } as const

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  fontId: 'system',
  fontSize: 18,
  lineHeight: 1.8,
  margin: 64,
  theme: 'auto'
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(max, Math.max(min, num))
}

/** 规范化阅读设置：非法值回退默认值，数值越界钳制到允许区间 */
export function normalizeReaderSettings(value: unknown): ReaderSettings {
  const raw = (value && typeof value === 'object' ? value : {}) as Partial<ReaderSettings>
  const fontId = READER_FONTS.some((f) => f.id === raw.fontId)
    ? (raw.fontId as string)
    : DEFAULT_READER_SETTINGS.fontId
  const theme = READER_THEMES.some((t) => t.id === raw.theme)
    ? (raw.theme as ReaderTheme)
    : DEFAULT_READER_SETTINGS.theme
  return {
    fontId,
    fontSize: Math.round(
      clampNumber(
        raw.fontSize,
        READER_FONT_SIZE_RANGE.min,
        READER_FONT_SIZE_RANGE.max,
        DEFAULT_READER_SETTINGS.fontSize
      )
    ),
    lineHeight:
      Math.round(
        clampNumber(
          raw.lineHeight,
          READER_LINE_HEIGHT_RANGE.min,
          READER_LINE_HEIGHT_RANGE.max,
          DEFAULT_READER_SETTINGS.lineHeight
        ) * 10
      ) / 10,
    margin: Math.round(
      clampNumber(
        raw.margin,
        READER_MARGIN_RANGE.min,
        READER_MARGIN_RANGE.max,
        DEFAULT_READER_SETTINGS.margin
      )
    ),
    theme
  }
}

/** 字体栈：找不到 id 时回退系统默认 */
export function fontStackOf(fontId: string): string {
  return (READER_FONTS.find((f) => f.id === fontId) ?? READER_FONTS[0]).stack
}

/* ------------------------------ 阅读区配色 ------------------------------ */

/** 阅读内容区配色 */
export interface ReaderPalette {
  /** 内容区背景 */
  background: string
  /** 正文文字颜色 */
  text: string
  /** 次要文字（页码 / 提示） */
  textSoft: string
  /** 是否深色（图片边框、滚动条等细节用） */
  dark: boolean
}

const PALETTES: Record<'light' | 'sepia' | 'dark', ReaderPalette> = {
  light: { background: '#FFFFFF', text: '#26282B', textSoft: '#8A9199', dark: false },
  sepia: { background: '#F7F1E1', text: '#4A4133', textSoft: '#948971', dark: false },
  dark: { background: '#17191D', text: '#C9CDD4', textSoft: '#7A828C', dark: true }
}

/**
 * 解析阅读区配色：auto 跟随应用主题（midnight 视为深色，其余浅色主题使用浅色阅读配色）。
 */
export function resolveReaderPalette(theme: ReaderTheme, appThemeIsDark: boolean): ReaderPalette {
  if (theme === 'auto') return appThemeIsDark ? PALETTES.dark : PALETTES.light
  return PALETTES[theme]
}