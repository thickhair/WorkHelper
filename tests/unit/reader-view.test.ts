// @vitest-environment jsdom
/**
 * 阅读视图测试：
 * 1）书架（ReaderLibraryView）：空态、网格渲染、进入阅读页、导入（mock 元数据解析）、移除二次确认；
 * 2）阅读页（ReaderView）：加载与进度恢复、翻页与键盘、书签、目录、阅读设置、错误态。
 * 阅读引擎（EPUB / PDF / 文本）被 mock，仅验证阅读页与引擎、IPC 的交互契约。
 */
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Book, Bookmark, BookmarkInput } from '@shared/types'
import type { ReaderSettings } from '@shared/reader'

const { pushMock, routeMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  routeMock: { params: { id: '1' } as Record<string, string> }
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
  useRoute: () => routeMock
}))

const engineMock = vi.hoisted(() => {
  const baseLocation = { location: 'epubcfi(/6/4)', percent: 40, label: '第一章' }
  const defaultToc = [{ id: 't1', label: '第一章', level: 0, target: 'ch1.xhtml' }]
  const engine = {
    toc: [...defaultToc],
    load: vi.fn(async () => undefined),
    destroy: vi.fn(),
    next: vi.fn(),
    prev: vi.fn(),
    goTo: vi.fn(),
    goToPercent: vi.fn(),
    getLocation: vi.fn(() => ({ ...baseLocation })),
    applySettings: vi.fn()
  }
  return {
    engine,
    baseLocation,
    defaultToc,
    runtime: null as null | { onLocationChange: (location: typeof baseLocation) => void }
  }
})

vi.mock('../../src/renderer/src/reader', () => ({
  createReaderEngine: (...args: unknown[]) => {
    engineMock.runtime = args[2] as typeof engineMock.runtime
    return engineMock.engine
  }
}))

vi.mock('../../src/renderer/src/reader/metadata', () => ({
  parseBookMeta: vi.fn(async () => ({
    title: '解析出的书名',
    author: '解析出的作者',
    cover: 'data:image/jpeg;base64,cover'
  }))
}))

const books: Book[] = [
  {
    id: 1,
    title: '示例书籍',
    author: '测试作者',
    format: 'epub',
    fileName: 'a.epub',
    fileSize: 2048,
    cover: '',
    location: 'epubcfi(/6/4)',
    progress: 40,
    lastReadAt: '2026-10-10 09:00:00',
    createdAt: '2026-10-09 08:00:00'
  },
  {
    id: 2,
    title: '未读的 PDF',
    author: '',
    format: 'pdf',
    fileName: 'b.pdf',
    fileSize: 1024 * 1024,
    cover: 'data:image/jpeg;base64,x',
    location: '',
    progress: 0,
    lastReadAt: '',
    createdAt: '2026-10-09 08:10:00'
  }
]

const apiMock = {
  win: {
    setFullScreen: vi.fn(async () => true)
  },
  books: {
    list: vi.fn(async () => [] as Book[]),
    get: vi.fn(async () => null as Book | null),
    import: vi.fn(async () => [] as Book[]),
    remove: vi.fn(async () => undefined),
    updateProgress: vi.fn(async () => null),
    updateMeta: vi.fn(async () => null),
    file: vi.fn(async () => new ArrayBuffer(8)),
    text: vi.fn(async () => '正文内容')
  },
  bookmarks: {
    list: vi.fn(async () => [] as Bookmark[]),
    create: vi.fn(async (input: BookmarkInput) => ({
      id: 11,
      createdAt: '2026-10-10 10:00:00',
      ...input
    })),
    remove: vi.fn(async () => undefined)
  },
  reader: {
    settings: vi.fn(async (): Promise<ReaderSettings> => ({
      fontId: 'system',
      fontSize: 18,
      lineHeight: 1.8,
      margin: 64,
      theme: 'auto'
    })),
    setSettings: vi.fn(async (value: ReaderSettings) => value)
  }
}

const engine = engineMock.engine

beforeEach(() => {
  vi.clearAllMocks()
  routeMock.params = { id: '1' }
  setActivePinia(createPinia())
  ;(window as unknown as { api: unknown }).api = apiMock
  engineMock.runtime = null
  engine.toc = [...engineMock.defaultToc]
  engine.load.mockResolvedValue(undefined)
  engine.getLocation.mockReturnValue({ ...engineMock.baseLocation })
})

/* -------------------------------- 书架 -------------------------------- */

describe('阅读 · 书架', () => {
  it('空书架展示引导与导入入口', async () => {
    apiMock.books.list.mockResolvedValueOnce([])
    const { default: ReaderLibraryView } = await import('../../src/renderer/src/views/ReaderLibraryView.vue')
    const wrapper = mount(ReaderLibraryView)
    await flushPromises()

    expect(wrapper.text()).toContain('书架还是空的')
    expect(wrapper.text()).toContain('导入第一本书')
  })

  it('书架渲染书籍卡片：封面 / 书名 / 格式与进度（未读提示）', async () => {
    apiMock.books.list.mockResolvedValueOnce(books)
    const { default: ReaderLibraryView } = await import('../../src/renderer/src/views/ReaderLibraryView.vue')
    const wrapper = mount(ReaderLibraryView)
    await flushPromises()

    const cards = wrapper.findAll('.book-card')
    expect(cards).toHaveLength(2)
    expect(cards[0].text()).toContain('示例书籍')
    expect(cards[0].text()).toContain('已读 40%')
    expect(cards[0].text()).toContain('EPUB')
    // 第二本有真实封面（img），且提示未开始阅读
    expect(cards[1].find('img').exists()).toBe(true)
    expect(cards[1].text()).toContain('未开始阅读')
  })

  it('点击卡片进入阅读页（携带书籍 id）', async () => {
    apiMock.books.list.mockResolvedValueOnce(books)
    const { default: ReaderLibraryView } = await import('../../src/renderer/src/views/ReaderLibraryView.vue')
    const wrapper = mount(ReaderLibraryView)
    await flushPromises()

    await wrapper.findAll('.book-card')[0].trigger('click')
    expect(pushMock).toHaveBeenCalledWith('/reader/book/1')
  })

  it('导入书籍：调用导入接口，EPUB 在后台解析元数据并回写', async () => {
    const importedBook: Book = { ...books[0], id: 3, title: 'new-book', progress: 0, lastReadAt: '' }
    apiMock.books.list.mockResolvedValueOnce([])
    const { default: ReaderLibraryView } = await import('../../src/renderer/src/views/ReaderLibraryView.vue')
    const wrapper = mount(ReaderLibraryView)
    await flushPromises()

    apiMock.books.import.mockResolvedValueOnce([importedBook])
    apiMock.books.list.mockResolvedValueOnce([importedBook])
    const importBtn = wrapper
      .findAll('button')
      .find((btn) => btn.text().includes('导入书籍'))!
    await importBtn.trigger('click')
    await flushPromises()

    expect(apiMock.books.import).toHaveBeenCalled()
    expect(apiMock.books.file).toHaveBeenCalledWith(3)
    expect(apiMock.books.updateMeta).toHaveBeenCalledWith(3, {
      title: '解析出的书名',
      author: '解析出的作者',
      cover: 'data:image/jpeg;base64,cover'
    })
  })

  it('移除书籍需二次确认后调用移除接口并刷新列表', async () => {
    apiMock.books.list.mockResolvedValue(books)
    const { default: ReaderLibraryView } = await import('../../src/renderer/src/views/ReaderLibraryView.vue')
    const wrapper = mount(ReaderLibraryView)
    await flushPromises()

    await wrapper.findAll('.bc-remove')[0].trigger('click')
    await flushPromises()
    const message = document.querySelector('.modal-body')?.textContent ?? ''
    expect(message).toContain('示例书籍')

    const confirmBtn = Array.from(document.querySelectorAll('.modal-foot button')).find((btn) =>
      btn.textContent?.includes('移除')
    ) as HTMLButtonElement
    confirmBtn.click()
    await flushPromises()

    expect(apiMock.books.remove).toHaveBeenCalledWith(1)
    wrapper.unmount()
  })
})

/* -------------------------------- 阅读页 -------------------------------- */

describe('阅读 · 阅读页', () => {
  async function mountReader(): Promise<ReturnType<typeof mount>> {
    const { default: ReaderView } = await import('../../src/renderer/src/views/ReaderView.vue')
    const wrapper = mount(ReaderView)
    await flushPromises()
    await flushPromises()
    return wrapper
  }

  it('加载 EPUB：展示书名 / 元信息，读取文件并恢复上次阅读位置', async () => {
    apiMock.books.get.mockResolvedValueOnce(books[0])
    const wrapper = await mountReader()

    expect(apiMock.books.get).toHaveBeenCalledWith(1)
    expect(apiMock.books.file).toHaveBeenCalledWith(1)
    expect(engine.load).toHaveBeenCalled()
    expect(wrapper.find('.rb-name').text()).toBe('示例书籍')
    expect(wrapper.find('.rb-sub').text()).toContain('测试作者')
    expect(wrapper.find('.rf-label').text()).toBe('第一章')
    expect(wrapper.find('.rf-percent').text()).toBe('40%')
    wrapper.unmount()
  })

  it('翻页：底部按钮与键盘方向键均驱动引擎，位置变化即时刷新', async () => {
    apiMock.books.get.mockResolvedValueOnce(books[0])
    const wrapper = await mountReader()

    engine.next.mockImplementation(() => {
      engineMock.runtime?.onLocationChange({
        location: 'epubcfi(/6/6)',
        percent: 55,
        label: '第二章'
      })
    })
    const nextBtn = wrapper.findAll('.reader-foot .r-btn')[1]
    await nextBtn.trigger('click')
    await flushPromises()
    expect(engine.next).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.rf-label').text()).toBe('第二章')
    expect(wrapper.find('.rf-percent').text()).toBe('55%')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(engine.next).toHaveBeenCalledTimes(2)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    expect(engine.prev).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('添加 / 删除书签：面板展示列表并调用书签接口', async () => {
    apiMock.books.get.mockResolvedValueOnce(books[0])
    const wrapper = await mountReader()

    const bookmarkBtn = wrapper
      .findAll('.rb-actions .r-btn')
      .find((btn) => btn.attributes('title') === '书签')!
    await bookmarkBtn.trigger('click')

    const addBtn = wrapper
      .findAll('button')
      .find((btn) => btn.text().includes('添加当前页书签'))!
    await addBtn.trigger('click')
    await flushPromises()

    expect(apiMock.bookmarks.create).toHaveBeenCalledWith({
      bookId: 1,
      location: 'epubcfi(/6/4)',
      label: '第一章',
      percent: 40
    })
    expect(wrapper.find('.bm-label').text()).toBe('第一章')

    const dangerBtn = wrapper.find('.bm-row .icon-btn.danger')
    await dangerBtn.trigger('click')
    await flushPromises()
    expect(apiMock.bookmarks.remove).toHaveBeenCalledWith(11)
    expect(wrapper.find('.bm-row').exists()).toBe(false)
    wrapper.unmount()
  })

  it('目录：展示 EPUB 章节目录并在点击后跳转', async () => {
    apiMock.books.get.mockResolvedValueOnce(books[0])
    const wrapper = await mountReader()

    const tocBtn = wrapper
      .findAll('.rb-actions .r-btn')
      .find((btn) => btn.attributes('title') === '目录')!
    expect(tocBtn.exists()).toBe(true)
    await tocBtn.trigger('click')
    const tocItem = wrapper.find('.toc-item')
    expect(tocItem.text()).toBe('第一章')
    await tocItem.trigger('click')
    expect(engine.goTo).toHaveBeenCalledWith('ch1.xhtml')
    wrapper.unmount()
  })

  it('阅读设置：修改字号即时应用并持久化', async () => {
    apiMock.books.get.mockResolvedValueOnce(books[0])
    const wrapper = await mountReader()

    const settingsBtn = wrapper
      .findAll('.rb-actions .r-btn')
      .find((btn) => btn.attributes('title') === '阅读设置')!
    await settingsBtn.trigger('click')

    // 字号步进器：第一个 ＋ 按钮
    const plusBtn = wrapper
      .findAll('.stepper-btn')
      .find((btn) => btn.text().includes('＋'))!
    await plusBtn.trigger('click')
    await flushPromises()

    expect(apiMock.reader.setSettings).toHaveBeenCalledWith(
      expect.objectContaining({ fontSize: 19 })
    )
    expect(engine.applySettings).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('PDF 书籍：禁用字体设置并给出固定版式提示，无目录按钮', async () => {
    engine.toc = []
    routeMock.params = { id: '2' }
    apiMock.books.get.mockResolvedValueOnce(books[1])
    const wrapper = await mountReader()

    expect(apiMock.books.file).toHaveBeenCalledWith(2)
    const tocBtn = wrapper
      .findAll('.rb-actions .r-btn')
      .find((btn) => btn.attributes('title') === '目录')
    expect(tocBtn).toBeUndefined()

    const settingsBtn = wrapper
      .findAll('.rb-actions .r-btn')
      .find((btn) => btn.attributes('title') === '阅读设置')!
    await settingsBtn.trigger('click')
    expect(wrapper.text()).toContain('PDF 为固定版式')
    wrapper.unmount()
  })

  it('TXT 书籍通过文本接口加载，书籍不存在时展示错误态', async () => {
    const txtBook: Book = { ...books[0], id: 4, format: 'txt', title: 'txt 小说' }
    routeMock.params = { id: '4' }
    apiMock.books.get.mockResolvedValueOnce(txtBook)
    const wrapper = await mountReader()
    expect(apiMock.books.text).toHaveBeenCalledWith(4)
    wrapper.unmount()

    routeMock.params = { id: '9' }
    apiMock.books.get.mockResolvedValueOnce(null)
    const failed = await mountReader()
    expect(failed.text()).toContain('书籍不存在或已被移除')
    const backBtn = failed
      .findAll('button')
      .find((btn) => btn.text().includes('返回书架'))!
    await backBtn.trigger('click')
    expect(pushMock).toHaveBeenCalledWith('/reader')
    failed.unmount()
  })

  it('全屏沉浸：工具栏按钮切换窗口全屏，Esc 优先关闭面板、无面板时退出', async () => {
    apiMock.books.get.mockResolvedValueOnce(books[0])
    const wrapper = await mountReader()

    const immersiveBtn = wrapper
      .findAll('.rb-actions .r-btn')
      .find((btn) => btn.attributes('title')?.includes('全屏沉浸'))!
    expect(immersiveBtn.exists()).toBe(true)

    await immersiveBtn.trigger('click')
    await flushPromises()
    expect(apiMock.win.setFullScreen).toHaveBeenCalledWith(true)
    expect(wrapper.find('.reader-page').classes()).toContain('immersive')

    // 面板打开时 Esc 只关闭面板，不退出沉浸
    const settingsBtn = wrapper
      .findAll('.rb-actions .r-btn')
      .find((btn) => btn.attributes('title') === '阅读设置')!
    await settingsBtn.trigger('click')
    expect(wrapper.find('.reader-panel').exists()).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(wrapper.find('.reader-panel').exists()).toBe(false)
    expect(wrapper.find('.reader-page').classes()).toContain('immersive')
    expect(apiMock.win.setFullScreen).toHaveBeenCalledTimes(1)

    // 无面板时 Esc 退出沉浸并还原窗口全屏
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(apiMock.win.setFullScreen).toHaveBeenLastCalledWith(false)
    expect(wrapper.find('.reader-page').classes()).not.toContain('immersive')

    // F11 再次切换进入
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F11' }))
    await flushPromises()
    expect(apiMock.win.setFullScreen).toHaveBeenLastCalledWith(true)
    wrapper.unmount()
  })
})