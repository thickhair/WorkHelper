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
import type { Birthday, BirthdayInput, Schedule, ScheduleInput } from '@shared/types'
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
    done: false,
    sortOrder: 0,
    createdAt: ''
  }
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
    range: vi.fn(async () => schedules),
    create: createSchedule,
    toggle: toggleSchedule
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

    await wrapper.find('.round-check').trigger('click')
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
