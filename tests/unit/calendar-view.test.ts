// @vitest-environment jsdom
/**
 * 渲染层集成测试：挂载「日历」页面组件（mock window.api），
 * 验证月视图渲染、选中日详情、生日列表、右键功能菜单与倒数日 / 纪念日交互。
 */
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Anniversary } from '@shared/anniversaries'
import type {
  Birthday,
  BirthdayInput,
  HabitWithProgress,
  Schedule,
  ScheduleInput
} from '@shared/types'
import { addDays, formatDate, monthDayLabel, parseDate } from '@shared/logic'
import CalendarView from '../../src/renderer/src/views/CalendarView.vue'

const TODAY = formatDate(new Date())
const TODAY_DATE = parseDate(TODAY)
const YEAR = TODAY_DATE.getFullYear()
const MONTH = TODAY_DATE.getMonth() + 1
const DAY = TODAY_DATE.getDate()

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
  }
]

/** 选中日的习惯打卡记录（供当日详情展示） */
const habits: HabitWithProgress[] = [
  { id: 31, name: '跑步', icon: '🏃', target: 1, sortOrder: 0, archived: false, count: 1 },
  { id: 32, name: '多喝水', icon: '💧', target: 2, sortOrder: 1, archived: false, count: 1 }
]

const birthdays: Birthday[] = [
  {
    id: 1,
    name: '妈妈',
    calendar: 'lunar',
    month: 8,
    day: 15,
    remindDays: 3,
    note: '记得订蛋糕',
    createdAt: ''
  }
]

/** 倒数日（今天到达）与纪念日（每年今天，2020 年起） */
const anniversaries: Anniversary[] = [
  {
    id: 1,
    name: '资格考试',
    kind: 'countdown',
    year: YEAR,
    month: MONTH,
    day: DAY,
    note: '',
    createdAt: ''
  },
  {
    id: 2,
    name: '结婚纪念日',
    kind: 'anniversary',
    year: 2020,
    month: MONTH,
    day: DAY,
    note: '',
    createdAt: ''
  }
]

const saveBirthday = vi.fn(async (input: BirthdayInput) => ({ ...birthdays[0], ...input, id: 2 }))
const toggleSchedule = vi.fn(async (id: number, done: boolean) => ({ ...schedules[0], id, done }))
const createSchedule = vi.fn(async (input: ScheduleInput) => ({ ...schedules[0], ...input, id: 2 }))
const saveAnniversary = vi.fn(async (input: unknown) => ({ ...anniversaries[0], ...(input as object), id: 3 }))
const setMood = vi.fn(async (date: string, mood: number | null) =>
  mood === null ? null : { date, mood, updatedAt: '' }
)

/** 今日心情（开心） */
const moods = [{ date: TODAY, mood: 5, updatedAt: '' }]

/** 未来 7 天天气 */
const weatherDays = Array.from({ length: 7 }, (_, i) => ({
  date: addDays(TODAY, i),
  code: 0,
  text: '晴',
  icon: '☀️',
  tempMax: 25,
  tempMin: 15
}))

const apiMock = {
  schedules: {
    // 返回副本：勾选会直接修改列表项状态，避免污染模块级夹具
    range: vi.fn(async () => schedules.map((item) => ({ ...item }))),
    create: createSchedule,
    toggle: toggleSchedule
  },
  habits: {
    list: vi.fn(async () => habits)
  },
  stats: {
    day: vi.fn(async () => ({
      date: TODAY,
      taskDone: 1,
      taskTotal: 1,
      habitDone: 1,
      habitTotal: 2,
      progress: 67,
      statusLabel: '保持专注'
    })),
    // 近 7 天趋势（含今天）
    trend: vi.fn(async () =>
      Array.from({ length: 7 }, (_, i) => ({
        date: addDays(TODAY, i - 6),
        taskDone: i % 3,
        taskTotal: 3
      }))
    )
  },
  birthdays: {
    list: vi.fn(async () => [...birthdays]),
    save: saveBirthday,
    remove: vi.fn(async () => undefined)
  },
  anniversaries: {
    list: vi.fn(async () => [...anniversaries]),
    save: saveAnniversary,
    remove: vi.fn(async () => undefined)
  },
  moods: {
    range: vi.fn(async () => [...moods]),
    set: setMood
  },
  weather: {
    report: vi.fn(async () => ({
      location: 'Shanghai',
      latitude: 31.2,
      longitude: 121.4,
      updatedAt: '2026-10-09 13:05',
      updatedAtMs: Date.now(),
      days: weatherDays
    }))
  }
}

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/calendar', component: { template: '<div />' } }
  ]
})

beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
  ;(window as unknown as { api: unknown }).api = apiMock
  document.body.innerHTML = ''
})

async function mountView(): Promise<ReturnType<typeof mount>> {
  const wrapper = mount(CalendarView, {
    attachTo: document.body,
    global: { plugins: [router] }
  })
  await flushPromises()
  return wrapper
}

/** 打开今天所在单元格的右键菜单并返回菜单元素 */
async function openContextMenu(wrapper: ReturnType<typeof mount>): Promise<Element> {
  const cell = wrapper.find('.cell.today')
  await cell.trigger('contextmenu')
  await flushPromises()
  const menu = document.querySelector('.ctx-menu')
  expect(menu).toBeTruthy()
  return menu!
}

/** 在 body 内查找包含指定文案的按钮并点击 */
async function clickBodyButton(text: string): Promise<void> {
  const btn = Array.from(document.querySelectorAll('button')).find((el) =>
    el.textContent?.includes(text)
  ) as HTMLButtonElement | undefined
  expect(btn).toBeTruthy()
  btn!.click()
  await flushPromises()
}

describe('日历页面', () => {
  it('渲染 6×7 月视图与当前月份标题', async () => {
    const wrapper = await mountView()
    expect(wrapper.findAll('.weekday').length).toBe(7)
    expect(wrapper.findAll('.cell').length).toBe(42)
    expect(wrapper.text()).toContain(`${YEAR}年${MONTH}月`)
    // 今天所在的单元格带有高亮标记
    expect(wrapper.findAll('.cell.today').length).toBe(1)
    expect(apiMock.schedules.range).toHaveBeenCalled()
  })

  it('选中日详情展示农历、日程并支持勾选完成', async () => {
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('农历')
    expect(wrapper.text()).toContain('产品评审会')
    expect(wrapper.find('.dot.sched').exists()).toBe(true)

    // 定位「产品评审会」所在行后点击勾选
    const row = wrapper.findAll('.row').find((item) => item.text().includes('产品评审会'))
    expect(row).toBeTruthy()
    await row!.find('.round-check').trigger('click')
    await flushPromises()
    expect(toggleSchedule).toHaveBeenCalledWith(1, true)
  })

  it('当日详情展示日程清单、习惯打卡记录与完成率', async () => {
    const wrapper = await mountView()
    const text = wrapper.text()

    // 日程：时间、描述与勾选（不再有类型徽章 / 优先级标识）
    expect(text).toContain('产品评审会')
    expect(text).toContain('09:00')
    expect(text).toContain('与设计确认交互稿')
    expect(wrapper.find('.kind-tag').exists()).toBe(false)
    expect(wrapper.find('.priority-dot').exists()).toBe(false)

    // 习惯：打卡记录与达标情况
    expect(text).toContain('习惯打卡')
    expect(text).toContain('跑步')
    expect(text).toContain('1/2')

    // 完成率：进度条与日程 / 习惯明细
    expect(text).toContain('67%')
    expect(text).toContain('日程 1/1')

    // 勾选日程行调用日程切换接口
    const row = wrapper.findAll('.row').find((item) => item.text().includes('产品评审会'))
    expect(row).toBeTruthy()
    await row!.find('.round-check').trigger('click')
    await flushPromises()
    expect(toggleSchedule).toHaveBeenCalledWith(1, true)
  })

  it('生日列表展示历法与下次日期，并标注提醒状态', async () => {
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('妈妈')
    expect(wrapper.text()).toContain('农历')
    expect(wrapper.text()).toContain('生日管理')
    expect(wrapper.find('.birth-item').exists()).toBe(true)
  })

  it('新增生日弹窗可保存公历 / 农历与提醒天数', async () => {
    const wrapper = await mountView()
    const addBtn = wrapper.findAll('button').find((btn) => btn.text().includes('添加生日'))
    expect(addBtn).toBeTruthy()
    await addBtn!.trigger('click')
    await flushPromises()

    const modal = document.querySelector('.modal')
    expect(modal).toBeTruthy()

    const nameInput = modal!.querySelector('input.input') as HTMLInputElement
    nameInput.value = '爸爸'
    nameInput.dispatchEvent(new Event('input'))

    const saveBtn = Array.from(modal!.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('保存')
    ) as HTMLButtonElement
    saveBtn.click()
    await flushPromises()

    expect(saveBirthday).toHaveBeenCalledTimes(1)
    const payload = saveBirthday.mock.calls[0][0]
    expect(payload.name).toBe('爸爸')
    expect(payload.calendar).toBe('solar')
    // 默认值为今天的公历月日
    expect(payload.month).toBe(MONTH)
    expect(payload.day).toBe(DAY)
    expect(monthDayLabel(TODAY)).toBeTruthy()
  })

  it('展示未来一周天气与定位城市', async () => {
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('未来一周天气')
    expect(wrapper.text()).toContain('Shanghai')
    expect(wrapper.findAll('.weather-day')).toHaveLength(7)
    expect(wrapper.text()).toContain('25°')
  })

  it('月视图与当日详情展示心情，并可修改选中日心情', async () => {
    const wrapper = await mountView()
    // 月视图中带心情的日期显示表情，详情标题显示「开心」
    expect(wrapper.findAll('.cell-mood')).toHaveLength(1)
    expect(wrapper.text()).toContain('开心')

    const buttons = wrapper.findAll('.mood-btn')
    expect(buttons).toHaveLength(5)
    await buttons[1].trigger('click')
    await flushPromises()
    expect(setMood).toHaveBeenCalledWith(TODAY, 2)
  })
})

describe('日历数据看板', () => {
  it('展示四张指标卡、完成率环与近 7 天趋势', async () => {
    const wrapper = await mountView()
    const text = wrapper.text()

    expect(apiMock.stats.trend).toHaveBeenCalledWith(7)
    expect(text).toContain('数据看板')
    expect(text).toContain('日程总数')
    expect(text).toContain('已完成')
    expect(text).toContain('完成率')
    expect(text).toContain('平均完成耗时')
    expect(wrapper.findAll('.stat-card')).toHaveLength(4)

    // 选中日（今天）仅 1 项未完成日程：环形图展示 0/1 项完成
    expect(wrapper.find('.donut').exists()).toBe(true)
    expect(text).toContain('0/1 项完成')
    expect(text).toContain('今日完成率')
    expect(text).toContain('近 7 天完成趋势')
    // 无有效完成时刻样本时平均耗时显示「—」
    const avgCard = wrapper
      .findAll('.stat-card')
      .find((card) => card.text().includes('平均完成耗时'))!
    expect(avgCard.find('.stat-value').text()).toBe('—')
  })

  it('勾选日程后刷新近 7 天趋势数据', async () => {
    const wrapper = await mountView()
    expect(apiMock.stats.trend).toHaveBeenCalledTimes(1)

    const row = wrapper.findAll('.row').find((item) => item.text().includes('产品评审会'))
    await row!.find('.round-check').trigger('click')
    await flushPromises()

    expect(toggleSchedule).toHaveBeenCalledWith(1, true)
    expect(apiMock.stats.trend).toHaveBeenCalledTimes(2)
  })
})

describe('倒数日与纪念日', () => {
  it('月视图标记与侧栏管理卡展示倒数日 / 纪念日', async () => {
    const wrapper = await mountView()
    expect(apiMock.anniversaries.list).toHaveBeenCalled()
    // 今天同时有倒数日与纪念日到达
    expect(wrapper.findAll('.dot.anni').length).toBeGreaterThan(0)
    expect(wrapper.text()).toContain('倒数日与纪念日')
    expect(wrapper.text()).toContain('资格考试')
    expect(wrapper.text()).toContain('结婚纪念日')
    expect(wrapper.text()).toContain('就是今天')
  })

  it('侧栏「倒数日」按钮打开弹窗并可保存', async () => {
    const wrapper = await mountView()
    const addBtn = wrapper.findAll('.card-action').find((btn) => btn.text() === '倒数日')
    expect(addBtn).toBeTruthy()
    await addBtn!.trigger('click')
    await flushPromises()

    const modal = document.querySelector('.modal')
    expect(modal).toBeTruthy()
    expect(modal!.textContent).toContain('添加倒数日')

    const nameInput = modal!.querySelector('input.input') as HTMLInputElement
    nameInput.value = '考研倒计时'
    nameInput.dispatchEvent(new Event('input'))

    const saveBtn = Array.from(modal!.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('保存')
    ) as HTMLButtonElement
    saveBtn.click()
    await flushPromises()

    expect(saveAnniversary).toHaveBeenCalledTimes(1)
    const payload = saveAnniversary.mock.calls[0][0] as { kind: string; name: string }
    expect(payload.kind).toBe('countdown')
    expect(payload.name).toBe('考研倒计时')
  })
})

describe('日期右键菜单', () => {
  it('右键日期弹出功能菜单，包含添加生日 / 添加日程 / 倒数日 / 纪念日', async () => {
    const wrapper = await mountView()
    const menu = await openContextMenu(wrapper)

    const items = Array.from(menu.querySelectorAll('.ctx-item')).map((el) => el.textContent)
    expect(items.some((text) => text?.includes('添加生日'))).toBe(true)
    expect(items.some((text) => text?.includes('添加日程'))).toBe(true)
    expect(items.some((text) => text?.includes('倒数日'))).toBe(true)
    expect(items.some((text) => text?.includes('纪念日'))).toBe(true)

    // 点击遮罩关闭菜单
    ;(document.querySelector('.ctx-overlay') as HTMLElement).click()
    await flushPromises()
    expect(document.querySelector('.ctx-menu')).toBeNull()
  })

  it('菜单「添加日程」打开日程弹窗并保存到所选日期', async () => {
    const wrapper = await mountView()
    await openContextMenu(wrapper)
    await clickBodyButton('添加日程')

    const modal = document.querySelector('.modal')
    expect(modal).toBeTruthy()
    expect(modal!.textContent).toContain('添加日程')

    const titleInput = Array.from(modal!.querySelectorAll('input.input')).find(
      (el) => (el as HTMLInputElement).placeholder === '例如：产品评审会'
    ) as HTMLInputElement
    titleInput.value = '例会'
    titleInput.dispatchEvent(new Event('input'))

    const saveBtn = Array.from(modal!.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('保存')
    ) as HTMLButtonElement
    saveBtn.click()
    await flushPromises()

    expect(createSchedule).toHaveBeenCalledTimes(1)
    expect(createSchedule.mock.calls[0][0].date).toBe(TODAY)
    expect(createSchedule.mock.calls[0][0].title).toBe('例会')
  })

  it('菜单「添加生日」打开生日弹窗并按所选日期预填', async () => {
    const wrapper = await mountView()
    await openContextMenu(wrapper)
    await clickBodyButton('添加生日')

    const modal = document.querySelector('.modal')
    expect(modal).toBeTruthy()

    const nameInput = modal!.querySelector('input.input') as HTMLInputElement
    nameInput.value = '爷爷'
    nameInput.dispatchEvent(new Event('input'))

    const saveBtn = Array.from(modal!.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('保存')
    ) as HTMLButtonElement
    saveBtn.click()
    await flushPromises()

    expect(saveBirthday).toHaveBeenCalledTimes(1)
    const payload = saveBirthday.mock.calls[0][0]
    expect(payload.name).toBe('爷爷')
    // 按右键日期（今天）预填月日
    expect(payload.month).toBe(MONTH)
    expect(payload.day).toBe(DAY)
  })

  it('菜单「纪念日」打开纪念日弹窗（起始年份选填）', async () => {
    const wrapper = await mountView()
    await openContextMenu(wrapper)
    await clickBodyButton('纪念日')

    const modal = document.querySelector('.modal')
    expect(modal).toBeTruthy()
    expect(modal!.textContent).toContain('添加纪念日')
    expect(modal!.textContent).toContain('起始年份')

    const nameInput = modal!.querySelector('input.input') as HTMLInputElement
    nameInput.value = '入职纪念日'
    nameInput.dispatchEvent(new Event('input'))

    const saveBtn = Array.from(modal!.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('保存')
    ) as HTMLButtonElement
    saveBtn.click()
    await flushPromises()

    expect(saveAnniversary).toHaveBeenCalledTimes(1)
    const payload = saveAnniversary.mock.calls[0][0] as { kind: string; name: string; year: number | null }
    expect(payload.kind).toBe('anniversary')
    expect(payload.name).toBe('入职纪念日')
    expect(payload.year).toBeNull()
  })
})
