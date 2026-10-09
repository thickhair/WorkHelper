// @vitest-environment jsdom
/**
 * 主题功能测试：主题目录规范化、主题状态应用与持久化、设置页主题选择交互。
 */
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_THEME, normalizeTheme, THEME_CATALOG } from '@shared/themes'
import { useThemeStore } from '../../src/renderer/src/stores/theme'
import SettingsView from '../../src/renderer/src/views/SettingsView.vue'

const settings = {
  userName: '',
  dataPath: 'D:/data/workhelper.db',
  version: '1.0.0',
  sidebar: [] as string[],
  theme: DEFAULT_THEME
}

const getSettings = vi.fn(async () => settings)
const setTheme = vi.fn(async (id: string) => id)
const apiMock = {
  app: {
    getSettings,
    setTheme,
    driver: vi.fn(async () => 'better-sqlite3'),
    setUserName: vi.fn(async () => undefined),
    exportBackup: vi.fn(async () => null),
    importBackup: vi.fn(async () => null),
    openDataDir: vi.fn(async () => undefined),
    openExternal: vi.fn(async () => undefined)
  },
  modules: { list: vi.fn(async () => []) }
}

beforeEach(() => {
  vi.clearAllMocks()
  settings.theme = DEFAULT_THEME
  delete document.documentElement.dataset.theme
  setActivePinia(createPinia())
  ;(window as unknown as { api: unknown }).api = apiMock
})

describe('主题目录', () => {
  it('包含多套主题且默认主题合法', () => {
    expect(THEME_CATALOG.length).toBeGreaterThanOrEqual(5)
    expect(THEME_CATALOG[0].id).toBe(DEFAULT_THEME)
    expect(new Set(THEME_CATALOG.map((theme) => theme.id)).size).toBe(THEME_CATALOG.length)
  })

  it('规范化非法主题 id 时回退为默认主题', () => {
    expect(normalizeTheme('ocean')).toBe('ocean')
    expect(normalizeTheme('not-exist')).toBe(DEFAULT_THEME)
    expect(normalizeTheme(undefined)).toBe(DEFAULT_THEME)
  })
})

describe('主题状态', () => {
  it('init 读取已保存主题并应用到根节点', async () => {
    getSettings.mockResolvedValueOnce({ ...settings, theme: 'midnight' })
    const store = useThemeStore()
    await store.init()
    expect(store.current).toBe('midnight')
    expect(document.documentElement.dataset.theme).toBe('midnight')
  })

  it('set 会立即应用并持久化主题', async () => {
    const store = useThemeStore()
    await store.set('violet')
    expect(setTheme).toHaveBeenCalledWith('violet')
    expect(store.current).toBe('violet')
    expect(document.documentElement.dataset.theme).toBe('violet')
  })

  it('set 传入非法主题时回退默认值', async () => {
    const store = useThemeStore()
    await store.set('bad-theme')
    expect(setTheme).toHaveBeenCalledWith(DEFAULT_THEME)
    expect(document.documentElement.dataset.theme).toBe(DEFAULT_THEME)
  })
})

describe('设置页主题选择', () => {
  it('展示主题卡片并可切换主题', async () => {
    const wrapper = mount(SettingsView)
    await flushPromises()

    const cards = wrapper.findAll('.theme-card')
    expect(cards.length).toBe(THEME_CATALOG.length)
    expect(wrapper.text()).toContain('外观主题')
    expect(wrapper.text()).toContain('暗夜黑')

    const ocean = cards.find((card) => card.text().includes('海洋蓝'))
    expect(ocean).toBeTruthy()
    await ocean!.trigger('click')
    await flushPromises()

    expect(setTheme).toHaveBeenCalledWith('ocean')
    expect(document.documentElement.dataset.theme).toBe('ocean')
    expect(wrapper.find('.theme-card.active').text()).toContain('海洋蓝')
  })
})