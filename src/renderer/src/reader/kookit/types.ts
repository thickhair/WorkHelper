/**
 * kookit 内核类型定义。
 * 内核为压缩混淆的 ESM 包（无源码、API 无文档），此文件仅声明本项目实际调用到的最小表面，
 * 方法名与语义对齐 koodo-reader 的调用点；P4 阅读重构按需扩充。
 */

/** 传入 BookHelper.getRendition 的书籍配置（内核按需读取，除 format 外均可选） */
export interface KookitBookConfig {
  /** 书籍格式（大写：EPUB / PDF / TXT / MD / MOBI / DOCX / FB2 / HTML / CBZ / CACHE 等） */
  format: string
  /** 书籍唯一键（内核用于缓存与记录，建议使用业务 id 派生） */
  bookKey?: string
  /** 翻页模式：scroll（滚动）/ single（单页）/ double（双页） */
  readerMode?: string
  /** TXT 编码（为空时内核自行探测） */
  charset?: string | null
  /** 是否移动端（本项目恒为 no） */
  isMobile?: string
  /** 深色模式（yes / no） */
  isDarkMode?: string
  /** 阅读背景色（PDF 页面衬底等） */
  backgroundColor?: string
  /** 界面缩放 */
  scale?: number
  /** 书籍绝对路径（部分格式的流式读取使用；内存渲染可为空） */
  filePath?: string
  [key: string]: unknown
}

/** StyleHelper 所需的配置读取接口（kookit 将 ConfigService 作为参数传入，可用自实现对象替代） */
export interface KookitConfigLike {
  getReaderConfig(key: string): string | null | undefined
  getAllListConfig(key: string): string[]
}

/** 渲染实例（rendition）：kookit 的书籍渲染句柄 */
export interface KookitRendition {
  /** 内核实际使用的格式（TXT 等可能被归一化为 CACHE） */
  format?: string
  /** 将书籍渲染到指定容器；location 仅供 TXT 传入上次阅读位置 */
  renderTo(element: HTMLElement | null, location?: unknown): Promise<void>
  /** 移除已渲染内容（切换书籍 / 卸载时调用） */
  removeContent(): void
  /** 重新排版（字体 / 字号 / 主题变更后调用） */
  refreshContent(): Promise<void> | void
  /** 目录（嵌套结构，层级由导航文档决定） */
  getChapter(): unknown[]
  /** 各章节对应的渲染文档（iframe / 画布容器） */
  getChapterDoc(): unknown[]
  /** 打平目录层级为一维列表 */
  flatChapter(chapters: unknown): unknown[]
  /** 当前位置（含 text / count / chapterTitle / chapterDocIndex / percentage / cfi / page 等字段） */
  getPosition(): Record<string, unknown>
  /** 跳转到序列化后的位置（getPosition 的结果 JSON 字符串） */
  goToPosition(position: string): Promise<void>
  /** 跳转到指定 xpath（KoReader 同步位置） */
  goToXpath(xpath: string): Promise<void>
  /** 注册内核事件（rendered / page-changed / chapter-pages 等） */
  on(event: string, handler: (...args: unknown[]) => void): void
  /** 注销内核事件 */
  off(event: string, handler?: (...args: unknown[]) => void): void
  /** 下一页 */
  next(): void
  /** 上一页 */
  prev(): void
  /** 下一章 */
  nextChapter(): void
  /** 上一章 */
  prevChapter(): void
  /** 按章序号跳转 */
  goToChapterIndex(index: number): Promise<void> | void
  /** 全书搜索 */
  doSearch(keyword: string, ...rest: unknown[]): unknown
  /** 阅读进度（0-100） */
  getProgress(): number
  /** 替换当前文档字体文件（自定义字体） */
  displayFontUrl(fontName: string, url: string): Promise<void> | void
}