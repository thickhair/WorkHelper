// @vitest-environment jsdom
/**
 * 渲染层集成测试：挂载「首页」页面组件（mock window.api），
 * 验证日程管理、习惯打卡与心情打卡等交互。
 */
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HabitWithProgress, Schedule, ScheduleInput } from '@shared/types'
import { addDays, formatDate } from '@shared/logic'
import HomeView from '../../src/renderer/src/views/HomeView.vue'

const TODAY = formatDate(new Date())

const schedules: Schedule[] = [
  {
    id: 1,
    date: TODAY,
    time: '07:00',
    title: '起床 + 早餐',
    description: '开启一天，元气满满',
    color: '',
    pinned: false,
    done: true,
    completedAt: '2026-10-10 09:30:00',
    sortOrder: 0,
    createdAt: '2026-10-10 08:00:00'
  },
  {
    id: 2,
    date: TODAY,
    time: '09:30',
    title: '剪辑学习',
    description: '学习视频剪辑技巧',
    color: '',
    pinned: false,
    done: false,
    completedAt: '',
    sortOrder: 1,
    createdAt: ''
  }
]

const habits: HabitWithProgress[] = [
  { id: 31, name: '跑步', icon: '🏃', target: 1, sortOrder: 0, archived: false, count: 1 },
  { id: 32, name: '多喝水', icon: '💧', target: 2, sortOrder: 1, archived: false, count: 1 }
]

const toggleSchedule = vi.fn(async (id: number, done: boolean) => ({ ...schedules[0], id, done }))
const checkIn = vi.fn(async (id: number) => ({ ...habits[0], id, count: 2 }))
const setMood = vi.fn(async (date: string, mood: number | null) =>
  mood === null ? null : { date, mood, updatedAt: '' }
)

/** 近一年心情记录：昨天、前天已记录（今天未打卡，用于验证打卡状态与连续天数） */
const moodHistory = [
  { date: addDays(TODAY, -2), mood: 4, updatedAt: '' },
  { date: addDays(TODAY, -1), mood: 5, updatedAt: '' }
]

const apiMock = {
  schedules: {
    list: vi.fn(async () => schedules),
    create: vi.fn(async (input: ScheduleInput) => ({ ...schedules[0], ...input })),
    update: vi.fn(async () => schedules[0]),
    toggle: toggleSchedule,
    remove: vi.fn(async () => undefined),
    reorder: vi.fn(async () => undefined)
  },
  habits: {
    list: vi.fn(async () => habits),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    checkIn
  },
  stats: {
    day: vi.fn(async () => ({
      date: TODAY,
      taskDone: 1,
      taskTotal: 2,
      habitDone: 1,
      habitTotal: 2,
      progress: 50,
      statusLabel: '保持专注'
    }))
  },
  birthdays: { list: vi.fn(async () => []) },
  moods: {
    range: vi.fn(async () => [...moodHistory]),
    set: setMood
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
  ;(window as unknown as { api: unknown }).api = apiMock
})

/** 轻量测试路由：满足组件内 useRouter / RouterLink 的注入需求 */
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/calendar', component: { template: '<div />' } },
    { path: '/assets', component: { template: '<div />' } }
  ]
})

/** 挂载首页（满足 RouterLink / useRouter 注入需求） */
async function mountHome(): Promise<ReturnType<typeof mount>> {
  const wrapper = mount(HomeView, {
    global: {
      plugins: [router],
      stubs: { RouterLink: { template: '<a><slot /></a>' } }
    }
  })
  await flushPromises()
  return wrapper
}

describe('首页习惯打卡', () => {
  it('习惯面板展示进度并可点击圆环快速打卡', async () => {
    const wrapper = await mountHome()
    expect(wrapper.text()).toContain('习惯打卡')
    expect(wrapper.text()).toContain('跑步')
    expect(wrapper.text()).toContain('/1')

    const rings = wrapper.findAll('.ring')
    expect(rings.length).toBe(2)
    await rings[0].trigger('click')
    await flushPromises()
    expect(checkIn).toHaveBeenCalledWith(31, TODAY, 1)
  })
})

describe('习惯编辑弹窗（步进器与图标增强）', () => {
  it('目标次数为自绘步进器（1–20 边界钳制），图标候选 30 个', async () => {
    const wrapper = await mountHome()
    const manageBtn = wrapper.findAll('button').find((btn) => btn.text().includes('管理'))!
    await manageBtn.trigger('click')
    await flushPromises()

    // 管理弹窗通过 Teleport 渲染到 body：在弹窗内点击「新增习惯」
    const manager = document.querySelectorAll('.modal')[0]
    const addBtn = Array.from(manager.querySelectorAll<HTMLButtonElement>('button')).find((btn) =>
      btn.textContent?.includes('新增习惯')
    )!
    addBtn.click()
    await flushPromises()

    // 编辑弹窗为最后打开的模态框
    const modals = document.querySelectorAll('.modal')
    const editModal = modals[modals.length - 1]
    expect(editModal.textContent).toContain('添加习惯')
    expect(editModal.querySelectorAll('.icon-pick')).toHaveLength(30)

    const input = editModal.querySelector<HTMLInputElement>('.stepper-input')!
    expect(input.value).toBe('1')
    const buttons = editModal.querySelectorAll<HTMLButtonElement>('.stepper-btn')
    // 最小值时「−」禁用
    expect(buttons[0].disabled).toBe(true)

    buttons[1].click()
    await flushPromises()
    expect(input.value).toBe('2')

    buttons[0].click()
    buttons[0].click()
    await flushPromises()
    // 撤销到 0 时钳制回 1
    expect(input.value).toBe('1')
    wrapper.unmount()
  })
})

describe('首页心情打卡', () => {
  it('未打卡时提示打卡，点击后显示已打卡与连续打卡天数', async () => {
    const wrapper = await mountHome()

    // 加载近一年记录（今天未打卡）
    expect(apiMock.moods.range).toHaveBeenCalledWith(addDays(TODAY, -366), TODAY)
    expect(wrapper.text()).toContain('心情打卡')
    expect(wrapper.text()).toContain('今天还没打卡')
    const buttons = wrapper.findAll('.mood-btn')
    expect(buttons).toHaveLength(5)

    // 点击「开心」完成今日打卡：昨天、前天已记录，连续 3 天
    await buttons[4].trigger('click')
    await flushPromises()
    expect(setMood).toHaveBeenCalledWith(TODAY, 5)
    expect(wrapper.text()).toContain('已打卡 · 连续打卡 3 天')
  })

  it('再次点击当前心情可取消打卡，恢复未打卡状态', async () => {
    const wrapper = await mountHome()
    const buttons = wrapper.findAll('.mood-btn')

    await buttons[4].trigger('click')
    await flushPromises()
    await buttons[4].trigger('click')
    await flushPromises()

    expect(setMood).toHaveBeenCalledWith(TODAY, null)
    expect(wrapper.text()).toContain('今天还没打卡')
  })
})

describe('首页统计卡片跳转', () => {
  it('四张统计卡片均为链接，点击后跳转到日历数据看板', async () => {
    await router.push('/')
    const wrapper = mount(HomeView, { global: { plugins: [router] } })
    await flushPromises()

    const links = wrapper.findAll('a.stat-link')
    expect(links).toHaveLength(4)
    for (const link of links) {
      expect(link.attributes('href')).toBe('/calendar')
      expect(link.attributes('title')).toContain('详情')
    }

    // 点击第一张卡片（今日日程）跳转到日历
    await links[0].trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/calendar')
  })
})