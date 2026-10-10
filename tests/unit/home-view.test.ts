// @vitest-environment jsdom
/**
 * 首页（整合日程管理）测试：今日日程清单（排序、「全天」展示、置顶与拖拽手柄）、
 * 勾选完成交互（接口调用与完成态样式）、添加弹窗（时间可选 + 颜色）。
 * 数据看板已迁移至日历页，由 calendar-view.test.ts 覆盖。
 */
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HabitWithProgress, MoodRecord, Schedule } from '@shared/types'
import { formatDate } from '@shared/logic'
import HomeView from '../../src/renderer/src/views/HomeView.vue'

const TODAY = formatDate(new Date())

const schedules: Schedule[] = [
  {
    id: 1,
    date: TODAY,
    time: '09:00',
    title: '产品评审会',
    description: '与设计确认交互稿',
    color: '',
    pinned: false,
    done: false,
    completedAt: '',
    sortOrder: 0,
    createdAt: ''
  },
  {
    id: 2,
    date: TODAY,
    time: '07:00',
    title: '起床 + 早餐',
    description: '开启一天',
    color: '',
    pinned: false,
    done: true,
    completedAt: '2026-10-10 07:30:00',
    sortOrder: 1,
    createdAt: '2026-10-10 07:00:00'
  },
  {
    id: 3,
    date: TODAY,
    time: '',
    title: '整理灵感笔记',
    description: '收集本周想法',
    color: '#5daf74',
    pinned: false,
    done: false,
    completedAt: '',
    sortOrder: 0,
    createdAt: ''
  },
  {
    id: 4,
    date: TODAY,
    time: '',
    title: '夜间跑步',
    description: '',
    color: '',
    pinned: false,
    done: false,
    completedAt: '',
    sortOrder: 1,
    createdAt: ''
  }
]

const habits: HabitWithProgress[] = [
  { id: 31, name: '跑步', icon: '🏃', target: 1, sortOrder: 0, archived: false, count: 0 }
]

const toggleSchedule = vi.fn(async (id: number, done: boolean) => ({ ...schedules[0], id, done }))

const apiMock = {
  schedules: {
    list: vi.fn(async () => schedules),
    create: vi.fn(),
    update: vi.fn(),
    toggle: toggleSchedule,
    remove: vi.fn(),
    reorder: vi.fn(async () => undefined)
  },
  habits: {
    list: vi.fn(async () => habits),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    checkIn: vi.fn()
  },
  stats: {
    day: vi.fn(async () => ({
      date: TODAY,
      taskDone: 1,
      taskTotal: 4,
      habitDone: 0,
      habitTotal: 1,
      progress: 20,
      statusLabel: '继续加油'
    }))
  },
  birthdays: { list: vi.fn(async () => []) },
  moods: {
    range: vi.fn(async () => [] as MoodRecord[]),
    set: vi.fn(async (date: string, mood: number | null) =>
      mood === null ? null : { date, mood, updatedAt: '' }
    )
  }
}

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/calendar', component: { template: '<div />' } },
    { path: '/assets', component: { template: '<div />' } }
  ]
})

beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
  ;(window as unknown as { api: unknown }).api = apiMock
})

async function mountView(): Promise<ReturnType<typeof mount>> {
  const wrapper = mount(HomeView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

describe('首页 · 今日日程清单', () => {
  it('未完成在前（时间升序、无时间按手动顺序排最后），已完成沉底，「全天」与描述正确展示', async () => {
    const wrapper = await mountView()
    const rows = wrapper.findAll('.task-row')
    expect(rows).toHaveLength(4)

    expect(rows[0].text()).toContain('产品评审会')
    expect(rows[1].text()).toContain('整理灵感笔记')
    expect(rows[2].text()).toContain('夜间跑步')
    expect(rows[3].text()).toContain('起床 + 早餐')
    expect(rows[3].classes()).toContain('done')

    // 待完成统计与「全天」/描述展示
    expect(wrapper.text()).toContain('3 项待完成 · 共 4 项')
    expect(rows[1].find('.row-time').text()).toBe('全天')
    expect(rows[1].find('.row-time').classes()).toContain('all-day')
    expect(rows[0].text()).toContain('与设计确认交互稿')
  })

  it('点击勾选日程：调用切换接口并进入完成态（已完成项沉底）', async () => {
    const wrapper = await mountView()
    const firstRow = wrapper.findAll('.task-row')[0]
    expect(firstRow.text()).toContain('产品评审会')

    await firstRow.find('.round-check').trigger('click')
    await flushPromises()

    expect(toggleSchedule).toHaveBeenCalledWith(1, true)
    // 完成后该项排到清单末尾，并带完成态样式
    const rows = wrapper.findAll('.task-row')
    const updated = rows.find((row) => row.text().includes('产品评审会'))!
    expect(updated.classes()).toContain('done')
    expect(updated.find('.round-check').classes()).toContain('checked')
    expect(rows[rows.length - 1].text()).toContain('产品评审会')
  })
})

describe('首页 · 日程操作', () => {
  it('「添加」按钮打开日程弹窗：默认「全天」、颜色默认 + 8 色', async () => {
    const wrapper = await mountView()
    const addBtn = wrapper.findAll('.card-action').find((btn) => btn.text().includes('添加'))!
    expect(addBtn).toBeTruthy()

    await addBtn.trigger('click')
    await flushPromises()

    const modal = document.querySelector('.modal')!
    expect(modal.textContent).toContain('添加日程')
    const timePicks = modal.querySelectorAll('.time-pick')
    expect(timePicks).toHaveLength(2)
    expect(timePicks[0].classList.contains('active')).toBe(true)
    // 默认不设置时间：不渲染时间输入框
    expect(modal.querySelector('.time-input')).toBeNull()
    // 颜色标记：默认 + 8 色
    expect(modal.querySelectorAll('.color-pick')).toHaveLength(9)
    wrapper.unmount()
  })

  it('切换「指定时间」后出现时间输入；日程行提供置顶图钉与拖拽手柄', async () => {
    const wrapper = await mountView()
    const addBtn = wrapper.findAll('.card-action').find((btn) => btn.text().includes('添加'))!
    await addBtn.trigger('click')
    await flushPromises()

    const modal = document.querySelector('.modal')!
    const timePicks = modal.querySelectorAll<HTMLButtonElement>('.time-pick')
    timePicks[1].click()
    await flushPromises()
    expect(modal.querySelector('.time-input')).not.toBeNull()

    // 每条日程行有置顶图钉；仅未设置时间的日程（2 条）有拖拽手柄
    expect(wrapper.findAll('.pin-btn')).toHaveLength(4)
    expect(wrapper.findAll('.drag-grip')).toHaveLength(2)
    wrapper.unmount()
  })

  it('点击图钉调用置顶更新接口', async () => {
    const wrapper = await mountView()
    // 清单顺序：产品评审会 09:00 → 整理灵感笔记 → 夜间跑步 → 已完成日程
    await wrapper.findAll('.pin-btn')[0].trigger('click')
    await flushPromises()
    expect(apiMock.schedules.update).toHaveBeenCalledWith(1, { pinned: true })
    wrapper.unmount()
  })
})