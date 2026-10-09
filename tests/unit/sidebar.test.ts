// @vitest-environment jsdom
/**
 * 功能广场与侧边栏配置测试：目录规范化、增删行为、持久化调用与页面渲染。
 */
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SIDEBAR, normalizeSidebar } from '@shared/features'
import { formatDate } from '@shared/logic'
import { useSidebarStore } from '../../src/renderer/src/stores/sidebar'
import AppSidebar from '../../src/renderer/src/components/AppSidebar.vue'
import FocusView from '../../src/renderer/src/views/FocusView.vue'
import PlazaView from '../../src/renderer/src/views/PlazaView.vue'

const TODAY = formatDate(new Date())

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

const overview = vi.fn(async () => ({
  todayMinutes: 45,
  recent: [
    { id: 1, date: TODAY, title: '英语精读', minutes: 25, createdAt: '' },
    { id: 2, date: '2026-10-07', title: '剪辑练习', minutes: 20, createdAt: '' }
  ]
}))

const apiMock = {
  app: { getSettings, setSidebar },
  focus: { create: vi.fn(), overview }
}

beforeEach(() => {
  vi.clearAllMocks()
  settings.sidebar = []
  routeMock.path = '/'
  setActivePinia(createPinia())
  ;(window as unknown as { api: unknown }).api = apiMock
})

describe('功能目录', () => {
  it('默认侧边栏只包含「每日计划」', () => {
    expect(DEFAULT_SIDEBAR).toEqual(['plan'])
  })

  it('规范化配置会过滤未知项与重复项，并统一为目录顺序', () => {
    expect(normalizeSidebar(['m-ai', 'unknown', 'm-ai', 42, 'plan'])).toEqual(['plan', 'm-ai'])
    expect(normalizeSidebar('bad-value')).toEqual(DEFAULT_SIDEBAR)
  })
})

describe('侧边栏配置', () => {
  it('默认配置下侧边栏只显示「每日计划」（首页 / 功能广场 / 设置默认不在列表中）', async () => {
    getSettings.mockResolvedValueOnce({ ...settings, sidebar: [...DEFAULT_SIDEBAR] })
    const store = useSidebarStore()
    await store.init()
    expect(store.items.map((item) => item.id)).toEqual(['plan'])
  })

  it('init 会读取已保存的配置并生效', async () => {
    getSettings.mockResolvedValueOnce({ ...settings, sidebar: ['focus', 'm-english'] })
    const store = useSidebarStore()
    await store.init()
    expect(store.enabled).toEqual(['m-english', 'focus'])
    expect(store.items.map((item) => item.id)).toContain('focus')
    expect(store.items.map((item) => item.id)).not.toContain('plan')
  })

  it('添加与移除功能会持久化到设置', async () => {
    const store = useSidebarStore()
    await store.add('focus')
    expect(setSidebar).toHaveBeenCalledTimes(1)
    expect(setSidebar.mock.calls[0][0]).toContain('focus')
    expect(store.enabled).toContain('focus')

    await store.remove('plan')
    expect(setSidebar).toHaveBeenCalledTimes(2)
    expect(setSidebar.mock.calls[1][0]).not.toContain('plan')
    expect(store.enabled).not.toContain('plan')
    expect(store.items.map((item) => item.id)).not.toContain('plan')
  })

  it('所有功能都可移除（含首页 / 功能广场 / 设置）', async () => {
    getSettings.mockResolvedValueOnce({ ...settings, sidebar: ['home', 'plaza', 'plan', 'settings'] })
    const store = useSidebarStore()
    await store.init()
    await store.remove('plaza')
    expect(setSidebar).toHaveBeenCalledTimes(1)
    expect(setSidebar.mock.calls[0][0]).not.toContain('plaza')
    expect(store.enabled).not.toContain('plaza')
    expect(store.items.map((item) => item.id)).not.toContain('plaza')
  })
})

describe('功能广场页面', () => {
  it('展示分组与功能卡片，点击添加后显示在侧边栏', async () => {
    getSettings.mockResolvedValueOnce({ ...settings, sidebar: [...DEFAULT_SIDEBAR] })
    const wrapper = mount(PlazaView)
    await flushPromises()

    const text = wrapper.text()
    expect(text).toContain('功能广场')
    expect(text).toContain('常用功能')
    expect(text).toContain('学习模块')
    expect(text).toContain('实用工具')
    expect(text).toContain('系统功能')

    // 找到「专注空间」卡片并点击添加
    const card = wrapper.findAll('.feature-card').find((item) => item.text().includes('专注空间'))
    expect(card).toBeTruthy()
    const addBtn = card!.findAll('button').find((btn) => btn.text().includes('添加'))
    expect(addBtn).toBeTruthy()
    await addBtn!.trigger('click')
    await flushPromises()

    expect(setSidebar).toHaveBeenCalledWith(expect.arrayContaining(['focus']))
    expect(useSidebarStore().enabled).toContain('focus')
  })
})

describe('专注空间页面', () => {
  it('展示今日专注时长与最近记录', async () => {
    const wrapper = mount(FocusView)
    await flushPromises()
    expect(overview).toHaveBeenCalled()
    const text = wrapper.text()
    expect(text).toContain('专注空间')
    expect(text).toContain('45 分钟')
    expect(text).toContain('英语精读')
    expect(text).toContain('剪辑练习')
  })

  it('切换预设时长会更新倒计时显示', async () => {
    const wrapper = mount(FocusView)
    await flushPromises()
    const chip = wrapper.findAll('.preset-chip').find((btn) => btn.text().includes('45'))
    expect(chip).toBeTruthy()
    await chip!.trigger('click')
    expect(wrapper.find('.time-display').text()).toBe('45:00')
  })
})

describe('侧边栏移除交互', () => {
  async function mountSidebar(): Promise<ReturnType<typeof mount>> {
    const wrapper = mount(AppSidebar, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } }
    })
    await flushPromises()
    return wrapper
  }

  it('所有侧边栏功能都显示移除按钮', async () => {
    getSettings.mockResolvedValueOnce({ ...settings, sidebar: ['home', 'plan', 'settings'] })
    await useSidebarStore().init()
    const wrapper = await mountSidebar()

    const homeItem = wrapper.findAll('.menu-item').find((item) => item.text().includes('首页'))
    expect(homeItem?.find('.remove-btn').exists()).toBe(true)

    const planItem = wrapper.findAll('.menu-item').find((item) => item.text().includes('每日计划'))
    expect(planItem?.find('.remove-btn').exists()).toBe(true)
  })

  it('侧边栏未包含「功能广场」时显示常驻「添加功能」入口，点击进入功能广场', async () => {
    getSettings.mockResolvedValueOnce({ ...settings, sidebar: [...DEFAULT_SIDEBAR] })
    await useSidebarStore().init()
    const wrapper = await mountSidebar()

    const addEntry = wrapper.find('.foot-add')
    expect(addEntry.exists()).toBe(true)
    await addEntry.trigger('click')
    expect(pushMock).toHaveBeenCalledWith('/plaza')
  })

  it('「功能广场」已在侧边栏时不显示常驻入口', async () => {
    getSettings.mockResolvedValueOnce({ ...settings, sidebar: ['plan', 'plaza'] })
    await useSidebarStore().init()
    const wrapper = await mountSidebar()
    expect(wrapper.find('.foot-add').exists()).toBe(false)
  })

  it('点击移除按钮会从侧边栏移除该功能并持久化', async () => {
    getSettings.mockResolvedValueOnce({ ...settings, sidebar: [...DEFAULT_SIDEBAR] })
    const wrapper = await mountSidebar()

    const planItem = wrapper.findAll('.menu-item').find((item) => item.text().includes('每日计划'))
    await planItem!.find('.remove-btn').trigger('click')
    await flushPromises()

    expect(setSidebar).toHaveBeenCalledWith(expect.not.arrayContaining(['plan']))
    expect(useSidebarStore().enabled).not.toContain('plan')
    expect(wrapper.text()).not.toContain('每日计划')
  })

  it('移除当前所在功能时会触发跳转', async () => {
    getSettings.mockResolvedValueOnce({ ...settings, sidebar: [...DEFAULT_SIDEBAR] })
    routeMock.path = '/plan'
    const wrapper = await mountSidebar()

    const planItem = wrapper.findAll('.menu-item').find((item) => item.text().includes('每日计划'))
    await planItem!.find('.remove-btn').trigger('click')
    await flushPromises()

    expect(pushMock).toHaveBeenCalledWith('/')
  })
})