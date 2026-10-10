/**
 * 阅读内容样式：EPUB 内嵌文档注入的 CSS 与文本文档容器的行内样式。
 * 统一使用阅读设置（字体 / 字号 / 行距 / 页边距）与阅读配色。
 */
import { fontStackOf, type ReaderPalette, type ReaderSettings } from '@shared/reader'

/** EPUB 章节内嵌文档的注入 CSS（通过 epubjs themes 应用） */
export function readerContentCss(settings: ReaderSettings, palette: ReaderPalette): string {
  const link = palette.dark ? '#7fb2e5' : '#3d7bb0'
  const selection = palette.dark ? 'rgba(120,160,220,.35)' : 'rgba(76,154,98,.22)'
  return `
    html { background: ${palette.background} !important; }
    body {
      background: ${palette.background} !important;
      color: ${palette.text} !important;
      font-family: ${fontStackOf(settings.fontId)} !important;
      font-size: ${settings.fontSize}px !important;
      line-height: ${settings.lineHeight} !important;
      padding: 0 ${settings.margin}px !important;
      margin: 0 !important;
      text-align: justify;
      -webkit-font-smoothing: antialiased;
    }
    p { line-height: inherit !important; }
    h1, h2, h3, h4, h5, h6 { color: ${palette.text} !important; line-height: 1.4 !important; }
    a { color: ${link} !important; }
    img { max-width: 100% !important; height: auto !important; }
    ::selection { background: ${selection}; }
  `
}

/** 文本文档（TXT / Markdown）流式容器的行内样式 */
export function applyTextFlowStyle(
  flow: HTMLElement,
  settings: ReaderSettings,
  palette: ReaderPalette
): void {
  flow.style.fontFamily = fontStackOf(settings.fontId)
  flow.style.fontSize = `${settings.fontSize}px`
  flow.style.lineHeight = String(settings.lineHeight)
  flow.style.color = palette.text
}