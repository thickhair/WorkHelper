// @vitest-environment jsdom
/**
 * 功能广场页面集成测试：网格布局、图标配色 / 样式与添加、移除交互。
 * 13 项功能移除后，可配置功能仅余「资产」一项。
 */
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CONFIGURABLE_FEATURES, FEATURE_CATALOG } from '@shared/features'
import { ICONS } from '../../src/renderer/src/components/icons'
import PlazaView from '../../src/renderer/src/views/PlazaView.vue'

const settings = { sidebar: [] as string[] }
const getSettings = vi.fn(async () => settings)
const setSidebar = vi.fn(async (ids: string[]) => ids)

const apiMock = {
  app: { getSettings, setSidebar }
}

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/plan', component: { template: '<div />' } },
    { path: '/assets', component: { template: '<div />' } },
    { path: '/plaza', component: { template: '<div />' } }
  ]
})

beforeEach(() => {
  vi.clearAllMocks()
  settings.sidebar = []
  setActivePinia(createPinia())
  ;(window as unknown as { api: unknown }).api = apiMock
})

async function mountView(): Promise<ReturnType<typeof mount>> {
  const wrapper = mount(PlazaView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

describe('功能广场', () => {
  it('以网格展示可配置功能（仅「资产」），带独立色调与徽章样式', async () => {
    const wrapper = await mountView()

    const tiles = wrapper.findAll('.tile')
    expect(tiles).toHaveLength(1)
    expect(tiles).toHaveLength(CONFIGURABLE_FEATURES.length)
    // 仅剩「实用工具」一个分组
    expect(wrapper.findAll('.group-dot')).toHaveLength(1)
    expect(wrapper.text()).toContain('实用工具')

    // 固定功能（首页 / 每日计划 / 日历 / 功能广场）与已删除功能不出现在广场网格中
    const names = tiles.map((tile) => tile.find('.tile-name').text())
    expect(names).toEqual(['资产'])
    for (const removed of ['首页', '每日计划', '日历', '功能广场', '设置', '专注空间', '数据统计']) {
      expect(names).not.toContain(removed)
    }

    const tile = tiles[0]
    expect(tile.classes().some((cls) => cls.startsWith('tone-'))).toBe(true)
    const badge = tile.find('.tile-badge')
    expect(['solid', 'soft', 'ring'].some((style) => badge.classes().includes(style))).toBe(true)
    // 图标必须有实际内容（名称在内置图标库中可解析）
    expect((badge.find('svg').element as SVGElement).innerHTML.length).toBeGreaterThan(0)

    // 目录内全部功能（含固定功能，用于侧边栏渲染）的图标均有定义
    for (const feature of FEATURE_CATALOG) {
      expect(ICONS[feature.icon]).toBeTruthy()
    }
  })

  it('点击「添加」把资产功能写入侧边栏配置', async () => {
    const wrapper = await mountView()

    const tile = wrapper.findAll('.tile').find((item) => item.text().includes('资产'))!
    const addButton = tile.findAll('button').find((btn) => btn.text().includes('添加'))!
    await addButton.trigger('click')
    await flushPromises()

    expect(setSidebar).toHaveBeenCalledTimes(1)
    expect(setSidebar.mock.calls[0][0]).toContain('assets')
  })

  it('已添加的功能可以移除', async () => {
    getSettings.mockResolvedValueOnce({ ...settings, sidebar: ['assets'] })
    const wrapper = await mountView()

    const tile = wrapper.findAll('.tile').find((item) => item.text().includes('资产'))!
    expect(tile.text()).toContain('已添加到侧边栏')

    const removeButton = tile.findAll('button').find((btn) => btn.text() === '移除')!
    await removeButton.trigger('click')
    await flushPromises()

    expect(setSidebar).toHaveBeenCalledTimes(1)
    expect(setSidebar.mock.calls[0][0]).not.toContain('assets')
  })
})
