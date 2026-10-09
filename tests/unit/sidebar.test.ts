// @vitest-environment jsdom
/**
 * 功能广场与侧边栏配置测试：功能目录规范化、固定功能语义（不可增删）、
 * 可配置功能（资产）增删持久化、页面渲染、右上角设置入口。
 */
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CONFIGURABLE_FEATURES,
  DEFAULT_SIDEBAR,
  FIXED_SIDEBAR,
  normalizeSidebar
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
  it('固定功能为首页 / 每日计划 / 日历 / 功能广场，可配置功能仅「资产」，默认不启用', () => {
    expect(FIXED_SIDEBAR).toEqual(['home', 'plan', 'calendar', 'plaza'])
    expect(CONFIGURABLE_FEATURES.map((f) => f.id)).toEqual(['assets'])
    expect(DEFAULT_SIDEBAR).toEqual([])
  })

  it('规范化配置会过滤未知项、已移除功能、重复项与固定项，并统一为目录顺序', () => {
    // 固定功能（home / plan）、已移除的设置项与已删除的功能（m-ai / focus 等）都会被过滤
    expect(
      normalizeSidebar(['assets', 'unknown', 'assets', 42, 'plan', 'home', 'settings', 'm-ai'])
    ).toEqual(['assets'])
    expect(normalizeSidebar(['focus', 'm-english', 'news', 'stats'])).toEqual([])
    expect(normalizeSidebar('bad-value')).toEqual(DEFAULT_SIDEBAR)
  })
})

describe('侧边栏配置', () => {
  it('固定功能始终显示，默认不含任何可配置功能', async () => {
    getSettings.mockResolvedValueOnce({ ...settings, sidebar: [...DEFAULT_SIDEBAR] })
    const store = useSidebarStore()
    await store.init()
    expect(store.items.map((item) => item.id)).toEqual(['home', 'plan', 'calendar', 'plaza'])
    expect(store.isEnabled('home')).toBe(true)
    expect(store.isEnabled('calendar')).toBe(true)
    expect(store.isEnabled('assets')).toBe(false)
  })

  it('init 会读取已保存的配置并生效（固定项置顶，可配置项依附其后）', async () => {
    getSettings.mockResolvedValueOnce({ ...settings, sidebar: ['assets'] })
    const store = useSidebarStore()
    await store.init()
    expect(store.enabled).toEqual(['assets'])
    expect(store.items.map((item) => item.id)).toEqual([
      'home',
      'plan',
      'calendar',
      'plaza',
      'assets'
    ])
  })

  it('历史配置中的已删除功能会被自动过滤', async () => {
    getSettings.mockResolvedValueOnce({ ...settings, sidebar: ['m-fitness', 'news', 'focus'] })
    const store = useSidebarStore()
    await store.init()
    expect(store.enabled).toEqual([])
    expect(store.items.map((item) => item.id)).toEqual(['home', 'plan', 'calendar', 'plaza'])
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
    await store.remove('plan')
    await store.remove('plaza')
    expect(setSidebar).toHaveBeenCalledTimes(2)
    expect(store.enabled).toEqual([])
  })

  it('历史配置中的固定功能与设置项会被自动过滤', async () => {
    getSettings.mockResolvedValueOnce({ ...settings, sidebar: ['home', 'plaza', 'plan', 'settings'] })
    const store = useSidebarStore()
    await store.init()
    expect(store.enabled).toEqual([])
    expect(store.items.map((item) => item.id)).toEqual(['home', 'plan', 'calendar', 'plaza'])
    expect(setSidebar).not.toHaveBeenCalled()
  })
})

describe('功能广场页面', () => {
  it('网格仅展示可配置功能（资产），点击添加后显示在侧边栏', async () => {
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
    expect(names).toEqual(['资产'])

    // 找到「资产」磁贴并点击添加
    const card = wrapper.findAll('.tile').find((item) => item.text().includes('资产'))
    expect(card).toBeTruthy()
    const addBtn = card!.findAll('button').find((btn) => btn.text().includes('添加'))
    expect(addBtn).toBeTruthy()
    await addBtn!.trigger('click')
    await flushPromises()

    expect(setSidebar).toHaveBeenCalledWith(expect.arrayContaining(['assets']))
    expect(useSidebarStore().enabled).toContain('assets')
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

  it('侧边栏固定显示首页 / 每日计划 / 日历 / 功能广场，且不渲染底部入口', async () => {
    getSettings.mockResolvedValueOnce({ ...settings, sidebar: [...DEFAULT_SIDEBAR] })
    await useSidebarStore().init()
    const wrapper = await mountSidebar()

    const names = wrapper.findAll('.menu-title').map((item) => item.text())
    expect(names).toEqual(['首页', '每日计划', '日历', '功能广场'])
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
