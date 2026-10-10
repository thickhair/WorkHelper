// @vitest-environment jsdom
/**
 * 功能广场与侧边栏配置测试：功能目录规范化（保序）、固定功能语义（不可增删 / 不可移动）、
 * 可配置功能（资产 / 阅读）增删与拖拽排序持久化、页面渲染、右上角设置入口。
 */
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CONFIGURABLE_FEATURES,
  DEFAULT_SIDEBAR,
  FIXED_SIDEBAR,
  featureByPath,
  filterKnownIds,
  normalizeSidebar,
  reorderSidebar
} from '@shared/features'
import { useSidebarStore } from '../../src/renderer/src/stores/sidebar'
import App from '../../src/renderer/src/App.vue'
import AppSidebar from '../../src/renderer/src/components/AppSidebar.vue'
import PlazaView from '../../src/renderer/src/views/PlazaView.vue'

const { pushMock, routeMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  routeMock: { path: '/' }
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock, currentRoute: { value: routeMock } }),
  useRoute: () => routeMock
}))

const settings = { userName: '', dataPath: '', version: '1.0.0', sidebar: [] as string[] }
const getSettings = vi.fn(async () => settings)
const setSidebar = vi.fn(async (ids: string[]) => ids)

const apiMock = {
  app: { getSettings, setSidebar },
  win: {
    minimize: vi.fn(),
    toggleMaximize: vi.fn(async () => false),
    close: vi.fn(),
    isMaximized: vi.fn(async () => false),
    onMaximizeChange: vi.fn()
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  settings.sidebar = []
  routeMock.path = '/'
  setActivePinia(createPinia())
  ;(window as unknown as { api: unknown }).api = apiMock
})

describe('功能目录', () => {
  it('固定功能为首页 / 日历 / 功能广场，可配置功能为「资产 / 阅读」，默认不启用', () => {
    expect(FIXED_SIDEBAR).toEqual(['home', 'calendar', 'plaza'])
    expect(CONFIGURABLE_FEATURES.map((f) => f.id)).toEqual(['assets', 'reader'])
    expect(DEFAULT_SIDEBAR).toEqual([])
  })

  it('featureByPath 支持功能页面的子路径匹配（阅读书架子页与普通页面一致）', () => {
    expect(featureByPath('/reader')?.id).toBe('reader')
    expect(featureByPath('/reader/book/12')?.id).toBe('reader')
    expect(featureByPath('/assets')?.id).toBe('assets')
    expect(featureByPath('/settings')).toBeUndefined()
    expect(featureByPath('/unknown')).toBeUndefined()
  })

  it('规范化配置会过滤未知项、已移除功能、重复项与固定项，并保留配置顺序', () => {
    // 固定功能（home / calendar）、已移除的设置项与已删除的功能（plan / m-ai / focus 等）都会被过滤
    expect(
      normalizeSidebar(['assets', 'unknown', 'assets', 42, 'plan', 'home', 'settings', 'm-ai'])
    ).toEqual(['assets'])
    expect(normalizeSidebar(['focus', 'm-english', 'news', 'stats'])).toEqual([])
    expect(normalizeSidebar('bad-value')).toEqual(DEFAULT_SIDEBAR)
  })

  it('保序过滤：保留输入顺序与首次出现位置（合成 id 验证）', () => {
    expect(filterKnownIds(['b', 'a', 'b', 'x', 42, 'a'], ['a', 'b'])).toEqual(['b', 'a'])
    expect(filterKnownIds(['a', 'a'], ['a'])).toEqual(['a'])
    expect(filterKnownIds('bad-value', ['a'])).toEqual([])
  })

  it('拖拽排序：移动到目标之前 / 之后，异常输入保持原顺序', () => {
    expect(reorderSidebar(['a', 'b', 'c'], 'a', 'c', false)).toEqual(['b', 'a', 'c'])
    expect(reorderSidebar(['a', 'b', 'c'], 'a', 'c', true)).toEqual(['b', 'c', 'a'])
    expect(reorderSidebar(['a', 'b', 'c'], 'c', 'a', false)).toEqual(['c', 'a', 'b'])
    expect(reorderSidebar(['a', 'b'], 'a', 'missing', true)).toEqual(['a', 'b'])
    expect(reorderSidebar(['a', 'b'], 'a', 'a', false)).toEqual(['a', 'b'])
    expect(reorderSidebar(['a'], 'a', 'a', true)).toEqual(['a'])
  })
})

describe('侧边栏配置', () => {
  it('固定功能始终显示，默认不含任何可配置功能', async () => {
    getSettings.mockResolvedValueOnce({ ...settings, sidebar: [...DEFAULT_SIDEBAR] })
    const store = useSidebarStore()
    await store.init()
    expect(store.items.map((item) => item.id)).toEqual(['home', 'calendar', 'plaza'])
    expect(store.isEnabled('home')).toBe(true)
    expect(store.isEnabled('calendar')).toBe(true)
    expect(store.isEnabled('assets')).toBe(false)
  })

  it('init 会读取已保存的配置并生效（可配置项排在功能广场之前，功能广场收尾）', async () => {
    getSettings.mockResolvedValueOnce({ ...settings, sidebar: ['assets'] })
    const store = useSidebarStore()
    await store.init()
    expect(store.enabled).toEqual(['assets'])
    expect(store.items.map((item) => item.id)).toEqual(['home', 'calendar', 'assets', 'plaza'])
  })

  it('历史配置中的已删除功能会被自动过滤', async () => {
    getSettings.mockResolvedValueOnce({ ...settings, sidebar: ['m-fitness', 'news', 'focus'] })
    const store = useSidebarStore()
    await store.init()
    expect(store.enabled).toEqual([])
    expect(store.items.map((item) => item.id)).toEqual(['home', 'calendar', 'plaza'])
  })

  it('可配置功能可添加移除并持久化，固定功能不可增删', async () => {
    const store = useSidebarStore()

    await store.add('assets')
    expect(setSidebar).toHaveBeenCalledTimes(1)
    expect(setSidebar.mock.calls[0][0]).toContain('assets')
    expect(store.enabled).toContain('assets')

    await store.remove('assets')
    expect(setSidebar).toHaveBeenCalledTimes(2)
    expect(setSidebar.mock.calls[1][0]).not.toContain('assets')
    expect(store.enabled).not.toContain('assets')

    // 固定功能、未知功能与已删除功能不参与配置，不触发持久化
    await store.add('home')
    await store.add('calendar')
    await store.add('stats')
    await store.remove('calendar')
    await store.remove('plaza')
    expect(setSidebar).toHaveBeenCalledTimes(2)
    expect(store.enabled).toEqual([])
  })

  it('拖拽排序会重排配置并持久化，原地移动不触发持久化', async () => {
    const store = useSidebarStore()
    // 目录中当前仅 assets 一项，直接置入合成 id 验证移动语义
    store.enabled = ['assets', 'demo']

    // 原地移动（移到自身原位）不触发持久化
    await store.move('assets', 'demo', false)
    expect(setSidebar).not.toHaveBeenCalled()

    await store.move('demo', 'assets', false)
    expect(setSidebar).toHaveBeenCalledTimes(1)
    expect(setSidebar.mock.calls[0][0]).toEqual(['demo', 'assets'])
    expect(store.enabled).toEqual(['demo', 'assets'])

    // 拖拽自身或目标不存在时不触发持久化
    await store.move('assets', 'assets', false)
    await store.move('missing', 'assets', true)
    expect(setSidebar).toHaveBeenCalledTimes(1)
  })

  it('排序结果以主进程返回的规范化配置为准', async () => {
    const store = useSidebarStore()
    store.enabled = ['assets', 'demo']
    // 主进程校验时会过滤未知 id（如已删除的功能）
    setSidebar.mockImplementationOnce(async () => ['assets'])
    await store.move('demo', 'assets', false)
    expect(store.enabled).toEqual(['assets'])
  })

  it('历史配置中的固定功能与设置项会被自动过滤', async () => {
    getSettings.mockResolvedValueOnce({ ...settings, sidebar: ['home', 'plaza', 'plan', 'settings'] })
    const store = useSidebarStore()
    await store.init()
    expect(store.enabled).toEqual([])
    expect(store.items.map((item) => item.id)).toEqual(['home', 'calendar', 'plaza'])
    expect(setSidebar).not.toHaveBeenCalled()
  })
})

describe('功能广场页面', () => {
  it('网格展示全部可配置功能（资产 / 阅读），点击添加后显示在侧边栏', async () => {
    getSettings.mockResolvedValueOnce({ ...settings, sidebar: [...DEFAULT_SIDEBAR] })
    const wrapper = mount(PlazaView)
    await flushPromises()

    const text = wrapper.text()
    expect(text).toContain('功能广场')
    expect(text).toContain('实用工具')
    // 固定功能、设置与已删除功能对应的分组不再出现
    expect(text).not.toContain('学习模块')
    expect(text).not.toContain('常用功能')
    expect(text).not.toContain('系统功能')

    const names = wrapper.findAll('.tile-name').map((item) => item.text())
    expect(names).toEqual(['资产', '阅读'])
    // 两个可配置功能并列展示且描述正确
    expect(wrapper.text()).toContain('EPUB / PDF / TXT / Markdown')

    // 找到「资产」磁贴并点击添加
    const card = wrapper.findAll('.tile').find((item) => item.text().includes('资产'))
    expect(card).toBeTruthy()
    const addBtn = card!.findAll('button').find((btn) => btn.text().includes('添加'))
    expect(addBtn).toBeTruthy()
    await addBtn!.trigger('click')
    await flushPromises()

    expect(setSidebar).toHaveBeenCalledWith(expect.arrayContaining(['assets']))
    expect(useSidebarStore().enabled).toContain('assets')

    // 再添加「阅读」：两项都保留在侧边栏配置中
    const readerCard = wrapper.findAll('.tile').find((item) => item.text().includes('阅读'))
    const readerAdd = readerCard!.findAll('button').find((btn) => btn.text().includes('添加'))
    await readerAdd!.trigger('click')
    await flushPromises()
    expect(useSidebarStore().enabled).toEqual(['assets', 'reader'])
  })
})

describe('侧边栏与右上角入口', () => {
  async function mountSidebar(): Promise<ReturnType<typeof mount>> {
    const wrapper = mount(AppSidebar, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } }
    })
    await flushPromises()
    return wrapper
  }

  it('侧边栏固定显示首页 / 日历 / 功能广场，且不渲染底部入口', async () => {
    getSettings.mockResolvedValueOnce({ ...settings, sidebar: [...DEFAULT_SIDEBAR] })
    await useSidebarStore().init()
    const wrapper = await mountSidebar()

    const names = wrapper.findAll('.menu-title').map((item) => item.text())
    expect(names).toEqual(['首页', '日历', '功能广场'])
    expect(wrapper.find('.foot-add').exists()).toBe(false)
  })

  it('固定功能没有移除按钮，可配置功能显示移除按钮', async () => {
    getSettings.mockResolvedValueOnce({ ...settings, sidebar: ['assets'] })
    await useSidebarStore().init()
    const wrapper = await mountSidebar()

    const homeItem = wrapper.findAll('.menu-item').find((item) => item.text().includes('首页'))
    expect(homeItem?.find('.remove-btn').exists()).toBe(false)

    const plazaItem = wrapper.findAll('.menu-item').find((item) => item.text().includes('功能广场'))
    expect(plazaItem?.find('.remove-btn').exists()).toBe(false)

    const assetsItem = wrapper.findAll('.menu-item').find((item) => item.text().includes('资产'))
    expect(assetsItem?.find('.remove-btn').exists()).toBe(true)
  })

  it('仅可配置功能显示拖拽手柄，菜单项禁用浏览器默认链接拖拽', async () => {
    getSettings.mockResolvedValueOnce({ ...settings, sidebar: ['assets'] })
    await useSidebarStore().init()
    const wrapper = await mountSidebar()

    const items = wrapper.findAll('.menu-item')
    items.forEach((item) => expect(item.attributes('draggable')).toBe('false'))

    const assetsItem = items.find((item) => item.text().includes('资产'))!
    const grip = assetsItem.find('.drag-grip')
    expect(grip.exists()).toBe(true)
    expect(grip.attributes('draggable')).toBe('true')

    expect(
      items.find((item) => item.text().includes('首页'))!.find('.drag-grip').exists()
    ).toBe(false)
    expect(
      items.find((item) => item.text().includes('功能广场'))!.find('.drag-grip').exists()
    ).toBe(false)
  })

  it('拖拽自身或未产生有效落点时不会触发持久化', async () => {
    getSettings.mockResolvedValueOnce({ ...settings, sidebar: ['assets'] })
    await useSidebarStore().init()
    const wrapper = await mountSidebar()

    const assetsItem = wrapper.findAll('.menu-item').find((item) => item.text().includes('资产'))!
    const dataTransfer = { setData: vi.fn(), effectAllowed: '' }
    await assetsItem.find('.drag-grip').trigger('dragstart', { dataTransfer })
    await assetsItem.trigger('dragover', { dataTransfer })
    await assetsItem.trigger('drop', { dataTransfer })
    await assetsItem.find('.drag-grip').trigger('dragend')

    expect(setSidebar).not.toHaveBeenCalled()
    expect(useSidebarStore().enabled).toEqual(['assets'])
  })

  it('点击移除按钮会从侧边栏移除该功能并持久化', async () => {
    getSettings.mockResolvedValueOnce({ ...settings, sidebar: ['assets'] })
    await useSidebarStore().init()
    const wrapper = await mountSidebar()

    const assetsItem = wrapper.findAll('.menu-item').find((item) => item.text().includes('资产'))
    await assetsItem!.find('.remove-btn').trigger('click')
    await flushPromises()

    expect(setSidebar).toHaveBeenCalledWith(expect.not.arrayContaining(['assets']))
    expect(useSidebarStore().enabled).not.toContain('assets')
    expect(wrapper.findAll('.menu-title').map((item) => item.text())).not.toContain('资产')
  })

  it('移除当前所在功能时会触发跳转', async () => {
    getSettings.mockResolvedValueOnce({ ...settings, sidebar: ['assets'] })
    routeMock.path = '/assets'
    await useSidebarStore().init()
    const wrapper = await mountSidebar()

    const assetsItem = wrapper.findAll('.menu-item').find((item) => item.text().includes('资产'))
    await assetsItem!.find('.remove-btn').trigger('click')
    await flushPromises()

    expect(pushMock).toHaveBeenCalledWith('/')
  })

  it('右上角设置入口可打开设置页，处于设置页时按钮高亮', async () => {
    const options = {
      global: {
        components: { RouterView: { template: '<div />' } },
        stubs: { RouterLink: { template: '<a><slot /></a>' } }
      }
    }
    const wrapper = mount(App, options)
    await flushPromises()

    const button = wrapper.find('.settings-btn')
    expect(button.exists()).toBe(true)
    expect(button.classes()).not.toContain('active')
    await button.trigger('click')
    expect(pushMock).toHaveBeenCalledWith('/settings')

    routeMock.path = '/settings'
    const activeWrapper = mount(App, options)
    await flushPromises()
    expect(activeWrapper.find('.settings-btn').classes()).toContain('active')
    // 侧边栏不再包含设置入口
    expect(activeWrapper.text()).toContain('功能广场')
    expect(activeWrapper.findAll('.menu-title').map((item) => item.text())).not.toContain('设置')
  })
})
