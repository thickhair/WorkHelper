// @vitest-environment jsdom
/**
 * 渲染层集成测试：挂载「每日计划」页面组件（mock window.api），
 * 验证数据加载、关键元素渲染与交互回调是否正确。
 */
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  HabitWithProgress,
  PriorityTask,
  Schedule,
  ScheduleInput,
  Todo
} from '@shared/types'
import { addDays, formatDate } from '@shared/logic'
import DailyPlanView from '../../src/renderer/src/views/DailyPlanView.vue'
import HomeView from '../../src/renderer/src/views/HomeView.vue'

const TODAY = formatDate(new Date())

const schedules: Schedule[] = [
  {
    id: 1,
    date: TODAY,
    time: '07:00',
    title: '起床 + 早餐',
    description: '开启一天，元气满满',
    done: true,
    sortOrder: 0,
    createdAt: ''
  },
  {
    id: 2,
    date: TODAY,
    time: '09:30',
    title: '剪辑学习',
    description: '学习视频剪辑技巧',
    done: false,
    sortOrder: 1,
    createdAt: ''
  }
]

const todos: Todo[] = [
  {
    id: 11,
    date: TODAY,
    title: '背 50 个英语单词',
    startTime: '08:00',
    endTime: '09:00',
    done: false,
    sortOrder: 0,
    createdAt: ''
  }
]

const priorities: PriorityTask[] = [
  {
    id: 21,
    date: TODAY,
    title: '完成英语学习打卡',
    startTime: '08:00',
    endTime: '09:00',
    priority: 'high',
    done: false,
    sortOrder: 0,
    createdAt: ''
  }
]

const habits: HabitWithProgress[] = [
  { id: 31, name: '跑步', icon: '🏃', target: 1, sortOrder: 0, archived: false, count: 1 },
  { id: 32, name: '多喝水', icon: '💧', target: 2, sortOrder: 1, archived: false, count: 1 }
]

const toggleSchedule = vi.fn(async (id: number, done: boolean) => ({ ...schedules[0], id, done }))
const toggleTodo = vi.fn(async (id: number, done: boolean) => ({ ...todos[0], id, done }))
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
    remove: vi.fn(async () => undefined)
  },
  todos: {
    list: vi.fn(async () => todos),
    create: vi.fn(),
    update: vi.fn(),
    toggle: toggleTodo,
    remove: vi.fn()
  },
  habits: {
    list: vi.fn(async () => habits),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    checkIn
  },
  priorities: {
    list: vi.fn(async () => priorities),
    create: vi.fn(),
    update: vi.fn(),
    toggle: vi.fn(),
    remove: vi.fn()
  },
  stats: {
    day: vi.fn(async () => ({
      date: TODAY,
      taskDone: 1,
      taskTotal: 4,
      habitDone: 1,
      habitTotal: 2,
      progress: 33,
      statusLabel: '继续加油'
    })),
    trend: vi.fn(async () => [])
  },
  birthdays: { list: vi.fn(async () => []) },
  moods: {
    range: vi.fn(async () => [...moodHistory]),
    set: setMood
  },
  focus: { create: vi.fn() }
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
    { path: '/plan', component: { template: '<div />' } },
    { path: '/calendar', component: { template: '<div />' } },
    { path: '/assets', component: { template: '<div />' } }
  ]
})

async function mountView(): Promise<ReturnType<typeof mount>> {
  const wrapper = mount(DailyPlanView, {
    global: {
      plugins: [router],
      stubs: { RouterLink: { template: '<a><slot /></a>' } }
    }
  })
  await flushPromises()
  return wrapper
}

describe('每日计划页面', () => {
  it('挂载后加载当日数据并渲染各卡片', async () => {
    const wrapper = await mountView()
    const text = wrapper.text()

    expect(apiMock.schedules.list).toHaveBeenCalled()
    expect(apiMock.todos.list).toHaveBeenCalled()
    expect(apiMock.habits.list).toHaveBeenCalled()
    expect(apiMock.priorities.list).toHaveBeenCalled()

    // 页面标题与问候语
    expect(text).toContain('每日计划')
    expect(text).toContain('起床 + 早餐')
    expect(text).toContain('07:00')
    expect(text).toContain('背 50 个英语单词')
    expect(text).toContain('完成英语学习打卡')
  })

  it('统计卡片展示任务、习惯与进度数据', async () => {
    const wrapper = await mountView()
    const text = wrapper.text()
    expect(text).toContain('1/4')
    expect(text).toContain('1/2')
    expect(text).toContain('33%')
    expect(text).toContain('继续加油')
  })

  it('习惯打卡显示进度并可点击打卡', async () => {
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('跑步')
    expect(wrapper.text()).toContain('/1')

    const rings = wrapper.findAll('.ring')
    expect(rings.length).toBe(2)
    await rings[0].trigger('click')
    await flushPromises()
    expect(checkIn).toHaveBeenCalledWith(31, TODAY, 1)
  })

  it('勾选日程会调用切换接口', async () => {
    const wrapper = await mountView()
    const checks = wrapper.findAll('.round-check')
    // 第一条为未完成的「剪辑学习」日程（含勾选框）
    await checks[0].trigger('click')
    await flushPromises()
    expect(toggleSchedule).toHaveBeenCalled()
  })

  it('「下一个任务」卡片展示推荐任务并提供开始按钮', async () => {
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('下一个任务')
    expect(wrapper.text()).toContain('剪辑学习')
    const startBtn = wrapper.findAll('button').find((btn) => btn.text().includes('开始'))
    expect(startBtn).toBeTruthy()
    await startBtn!.trigger('click')
    await flushPromises()
    // 点击开始后出现专注计时器
    expect(wrapper.find('.focus-timer').exists()).toBe(true)
  })
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
  it('四张统计卡片均为链接，点击后跳转到每日计划', async () => {
    await router.push('/')
    const wrapper = mount(HomeView, { global: { plugins: [router] } })
    await flushPromises()

    const links = wrapper.findAll('a.stat-link')
    expect(links).toHaveLength(4)
    for (const link of links) {
      expect(link.attributes('href')).toBe('/plan')
      expect(link.attributes('title')).toContain('详情')
    }

    // 点击第一张卡片（今日任务）跳转到每日计划
    await links[0].trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/plan')
  })
})