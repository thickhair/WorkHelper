<script setup lang="ts">
/**
 * 日历页：未来一周天气（自动定位）、月视图（公历 / 农历 / 节气 / 传统节日 /
 * 法定节假日与调休 / 每日心情）、选中日详情（农历、干支、节日、心情、日程），
 * 生日与「倒数日 / 纪念日」管理。右键点击任意日期可弹出功能菜单
 * （添加生日 / 添加日程 / 倒数日 / 纪念日）。
 */
import { computed, onMounted, ref, watch } from 'vue'
import type { Birthday, BirthdayInput, MoodRecord, Schedule } from '@shared/types'
import {
  daysUntilOccurrence,
  nextOccurrence,
  occurrenceInYear,
  upcomingYearCount,
  untilText,
  type Anniversary,
  type AnniversaryInput
} from '@shared/anniversaries'
import {
  birthdayDateLabel,
  birthdayDatesInRange,
  calendarDayOf,
  daysUntilBirthday,
  lunarDayText,
  lunarMonthName,
  nextBirthdayDate,
  type CalendarDay
} from '@shared/calendar'
import { moodEmoji, moodLabel } from '@shared/moods'
import type { WeatherResult } from '@shared/weather'
import { formatDate, monthDayLabel, parseDate, weekdayLabel } from '@shared/logic'
import { useToastStore } from '../stores/toast'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import Icon from '../components/Icon.vue'
import ModalDialog from '../components/ModalDialog.vue'
import MoodPicker from '../components/MoodPicker.vue'

const toast = useToastStore()

const today = formatDate(new Date())
const todayDate = parseDate(today)

/** 当前显示的月份（年 + 月 1-12） */
const view = ref({ year: todayDate.getFullYear(), month: todayDate.getMonth() + 1 })
/** 选中查看的日期 */
const selected = ref(today)

const schedules = ref<Schedule[]>([])
const birthdays = ref<Birthday[]>([])
const anniversaries = ref<Anniversary[]>([])
const moods = ref<MoodRecord[]>([])
const weather = ref<WeatherResult | null>(null)
const weatherError = ref('')
const weatherLoading = ref(false)

onMounted(() => {
  void loadMonth()
  void loadBirthdays()
  void loadAnniversaries()
  void loadWeather()
})

/* ------------------------------ 数据加载 ------------------------------ */

/** 月视图 42 格覆盖的日期区间（含相邻月补齐） */
const gridRange = computed(() => {
  const first = new Date(view.value.year, view.value.month - 1, 1)
  const offset = (first.getDay() + 6) % 7
  const from = new Date(view.value.year, view.value.month - 1, 1 - offset)
  const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 41)
  return { from: formatDate(from), to: formatDate(to) }
})

async function loadMonth(): Promise<void> {
  try {
    const { from, to } = gridRange.value
    const [scheduleData, moodData] = await Promise.all([
      window.api.schedules.range(from, to),
      window.api.moods.range(from, to)
    ])
    schedules.value = scheduleData
    moods.value = moodData
  } catch (err) {
    toast.error((err as Error).message)
  }
}

/** 获取未来一周天气（force 为 true 时强制刷新） */
async function loadWeather(force = false): Promise<void> {
  weatherLoading.value = true
  weatherError.value = ''
  try {
    weather.value = await window.api.weather.report(force)
  } catch (err) {
    weatherError.value = (err as Error).message
  } finally {
    weatherLoading.value = false
  }
}

async function loadBirthdays(): Promise<void> {
  try {
    birthdays.value = await window.api.birthdays.list()
  } catch (err) {
    toast.error((err as Error).message)
  }
}

async function loadAnniversaries(): Promise<void> {
  try {
    anniversaries.value = await window.api.anniversaries.list()
  } catch (err) {
    toast.error((err as Error).message)
  }
}

/* ------------------------------ 月视图 ------------------------------ */

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

interface DayCell extends CalendarDay {
  /** 是否属于当前显示的月份 */
  inMonth: boolean
  dayNumber: number
  isToday: boolean
  isSelected: boolean
  schedules: Schedule[]
  birthdays: Birthday[]
  anniversaries: Anniversary[]
  /** 当日心情等级（未记录为 null） */
  mood: number | null
}

const scheduleMap = computed(() => {
  const map = new Map<string, Schedule[]>()
  for (const item of schedules.value) {
    const list = map.get(item.date) ?? []
    list.push(item)
    map.set(item.date, list)
  }
  return map
})

const birthdayMap = computed(() => {
  const map = new Map<string, Birthday[]>()
  const { from, to } = gridRange.value
  for (const item of birthdays.value) {
    for (const date of birthdayDatesInRange(item, from, to)) {
      const list = map.get(date) ?? []
      list.push(item)
      map.set(date, list)
    }
  }
  return map
})

/** 日期 → 心情等级 */
const moodMap = computed(() => {
  const map = new Map<string, number>()
  for (const item of moods.value) map.set(item.date, item.mood)
  return map
})

/** 日期 → 倒数日 / 纪念日（倒数日取目标日期；纪念日按区间覆盖年份逐年展开） */
const anniversaryMap = computed(() => {
  const map = new Map<string, Anniversary[]>()
  const { from, to } = gridRange.value
  for (const item of anniversaries.value) {
    const dates: string[] = []
    if (item.kind === 'countdown') {
      const date = occurrenceInYear(item, item.year ?? 0)
      if (date >= from && date <= to) dates.push(date)
    } else {
      const fromYear = parseDate(from).getFullYear()
      const toYear = parseDate(to).getFullYear()
      for (let year = fromYear; year <= toYear; year += 1) {
        const date = occurrenceInYear(item, year)
        if (date >= from && date <= to) dates.push(date)
      }
    }
    for (const date of dates) {
      const list = map.get(date) ?? []
      list.push(item)
      map.set(date, list)
    }
  }
  return map
})

const cells = computed<DayCell[]>(() => {
  const first = new Date(view.value.year, view.value.month - 1, 1)
  const offset = (first.getDay() + 6) % 7
  const list: DayCell[] = []
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(view.value.year, view.value.month - 1, 1 - offset + i)
    const key = formatDate(date)
    const day = calendarDayOf(key)
    list.push({
      ...day,
      inMonth: date.getMonth() + 1 === view.value.month,
      dayNumber: date.getDate(),
      isToday: key === today,
      isSelected: key === selected.value,
      schedules: scheduleMap.value.get(key) ?? [],
      birthdays: birthdayMap.value.get(key) ?? [],
      anniversaries: anniversaryMap.value.get(key) ?? [],
      mood: moodMap.value.get(key) ?? null
    })
  }
  return list
})

/** 单元格副标题：节日 > 节气 > 农历初一显示月名 > 农历日 */
function cellSub(cell: DayCell): { text: string; tone: string } {
  if (cell.festivals.length > 0) return { text: cell.festivals[0], tone: 'festival' }
  if (cell.jieQi) return { text: cell.jieQi, tone: 'jieqi' }
  if (cell.lunar.day === 1) return { text: cell.lunar.monthName, tone: 'festival' }
  return { text: cell.lunar.dayText, tone: 'lunar' }
}

/** 单元格悬浮提示 */
function cellTitle(cell: DayCell): string {
  const parts = [`${cell.date} ${weekdayLabel(cell.date)}`, `农历${cell.lunar.text}（${cell.lunar.yearName}年）`]
  if (cell.jieQi) parts.push(cell.jieQi)
  if (cell.festivals.length > 0) parts.push(cell.festivals.join('、'))
  if (cell.holiday) parts.push(cell.holiday.type === 'off' ? `${cell.holiday.name} 休假` : `${cell.holiday.name} 补班`)
  if (cell.schedules.length > 0) parts.push(`${cell.schedules.length} 项日程`)
  if (cell.birthdays.length > 0) parts.push(`${cell.birthdays.map((b) => b.name).join('、')} 生日`)
  if (cell.anniversaries.length > 0) parts.push(cell.anniversaries.map((a) => a.name).join('、'))
  if (cell.mood !== null) parts.push(`心情：${moodLabel(cell.mood)}`)
  parts.push('右键：添加生日 / 日程 / 倒数日 / 纪念日')
  return parts.join(' · ')
}

function selectDate(date: string): void {
  selected.value = date
  const d = parseDate(date)
  if (d.getFullYear() !== view.value.year || d.getMonth() + 1 !== view.value.month) {
    view.value = { year: d.getFullYear(), month: d.getMonth() + 1 }
    void loadMonth()
  }
}

function shiftMonth(delta: number): void {
  const target = new Date(view.value.year, view.value.month - 1 + delta, 1)
  view.value = { year: target.getFullYear(), month: target.getMonth() + 1 }
  void loadMonth()
  const current = parseDate(selected.value)
  if (current.getFullYear() !== view.value.year || current.getMonth() + 1 !== view.value.month) {
    selected.value = formatDate(target)
  }
}

function goToday(): void {
  view.value = { year: todayDate.getFullYear(), month: todayDate.getMonth() + 1 }
  selected.value = today
  void loadMonth()
}

const monthLabel = computed(() => `${view.value.year}年${view.value.month}月`)

/* ------------------------------ 选中日详情 ------------------------------ */

const selectedDay = computed(() => calendarDayOf(selected.value))
const selectedSchedules = computed(() => scheduleMap.value.get(selected.value) ?? [])
const selectedBirthdays = computed(() => birthdayMap.value.get(selected.value) ?? [])
const selectedAnniversaries = computed(() => anniversaryMap.value.get(selected.value) ?? [])
/** 选中日心情等级（未记录为 null） */
const selectedMood = computed(() => moodMap.value.get(selected.value) ?? null)
const selectedLabel = computed(
  () => `${parseDate(selected.value).getFullYear()}年${monthDayLabel(selected.value)} ${weekdayLabel(selected.value)}`
)

/** 记录 / 修改选中日心情（value 为 null 表示取消记录） */
async function setMood(value: number | null): Promise<void> {
  const date = selected.value
  try {
    await window.api.moods.set(date, value)
    const rest = moods.value.filter((item) => item.date !== date)
    moods.value = value === null ? rest : [...rest, { date, mood: value, updatedAt: '' }]
    if (value !== null) toast.success(`已记录 ${monthDayLabel(date)} 的心情：${moodLabel(value)}`)
  } catch (err) {
    toast.error((err as Error).message)
  }
}

async function toggleSchedule(item: Schedule): Promise<void> {
  try {
    await window.api.schedules.toggle(item.id, !item.done)
    item.done = !item.done
  } catch (err) {
    toast.error((err as Error).message)
  }
}

/* ------------------------------ 生日管理 ------------------------------ */

/** 生日 + 下一次发生日信息（按临近程度排序） */
const birthdayItems = computed(() =>
  birthdays.value
    .map((item) => ({
      birthday: item,
      nextDate: nextBirthdayDate(item, today) ?? '',
      daysUntil: daysUntilBirthday(item, today)
    }))
    .sort((a, b) => a.daysUntil - b.daysUntil)
)

interface BirthdayForm {
  visible: boolean
  /** 编辑时的记录 id，新建为 undefined */
  id?: number
  name: string
  calendar: 'solar' | 'lunar'
  month: number
  day: number
  remindDays: number
  note: string
}

const dialog = ref<BirthdayForm>({
  visible: false,
  id: undefined,
  name: '',
  calendar: 'solar',
  month: 1,
  day: 1,
  remindDays: 0,
  note: ''
})

/** 删除确认目标 */
const removeTarget = ref<Birthday | null>(null)

const REMIND_OPTIONS = [
  { value: 0, label: '当天提醒' },
  { value: 1, label: '提前 1 天' },
  { value: 3, label: '提前 3 天' },
  { value: 7, label: '提前 7 天' },
  { value: 15, label: '提前 15 天' },
  { value: 30, label: '提前 30 天' }
]

/** 可选日期范围：公历按当月天数（允许 2 月 29 日），农历 1-30 */
const dayOptions = computed(() => {
  const max =
    dialog.value.calendar === 'lunar' ? 30 : new Date(2024, dialog.value.month, 0).getDate()
  return Array.from({ length: max }, (_, i) => i + 1)
})

// 切换历法或月份后，将超范围的「日」收敛到上限
watch(
  () => [dialog.value.calendar, dialog.value.month],
  () => {
    const max = dayOptions.value.length
    if (dialog.value.day > max) dialog.value.day = max
  }
)

function openCreate(date?: string): void {
  const d = date ? parseDate(date) : todayDate
  dialog.value = {
    visible: true,
    id: undefined,
    name: '',
    calendar: 'solar',
    month: d.getMonth() + 1,
    day: d.getDate(),
    remindDays: 0,
    note: ''
  }
}

function openEdit(item: Birthday): void {
  dialog.value = {
    visible: true,
    id: item.id,
    name: item.name,
    calendar: item.calendar,
    month: item.month,
    day: item.day,
    remindDays: item.remindDays,
    note: item.note
  }
}

async function saveBirthday(): Promise<void> {
  const form = dialog.value
  const payload: BirthdayInput = {
    id: form.id,
    name: form.name,
    calendar: form.calendar,
    month: form.month,
    day: form.day,
    remindDays: form.remindDays,
    note: form.note
  }
  try {
    await window.api.birthdays.save(payload)
    dialog.value.visible = false
    await loadBirthdays()
    toast.success(form.id ? '生日已更新' : '生日已添加')
  } catch (err) {
    toast.error((err as Error).message)
  }
}

async function confirmRemove(): Promise<void> {
  const target = removeTarget.value
  if (!target) return
  try {
    await window.api.birthdays.remove(target.id)
    removeTarget.value = null
    await loadBirthdays()
    toast.push(`已删除「${target.name}」的生日`, 'info')
  } catch (err) {
    toast.error((err as Error).message)
  }
}

/** 生日标签：公历「10月9日」/ 农历「八月十五」 */
function dateLabel(item: Birthday): string {
  return birthdayDateLabel(item)
}

/** 距下次生日的文案 */
function untilLabel(days: number): string {
  if (days === 0) return '就是今天'
  if (days === 1) return '明天'
  return `还有 ${days} 天`
}

/* --------------------------- 右键菜单与快捷添加 --------------------------- */

/** 日期右键菜单状态（x/y 为视口坐标，已做边缘收敛） */
const menu = ref({ visible: false, x: 0, y: 0, date: '' })

function openMenu(cell: DayCell, event: MouseEvent): void {
  const x = Math.min(event.clientX, window.innerWidth - 176)
  const y = Math.min(event.clientY, window.innerHeight - 176)
  menu.value = { visible: true, x, y, date: cell.date }
}

function closeMenu(): void {
  menu.value.visible = false
}

/** 菜单动作统一入口：选中日期并执行对应添加流程 */
function menuAction(action: 'birthday' | 'schedule' | 'countdown' | 'anniversary'): void {
  const date = menu.value.date
  closeMenu()
  selectDate(date)
  if (action === 'birthday') openCreate(date)
  else if (action === 'schedule') openScheduleCreate(date)
  else openAnniversaryCreate(action, date)
}

/* ------------------------------ 添加日程 ------------------------------ */

const scheduleDialog = ref({ visible: false, date: '', time: '09:00', title: '', description: '' })

function openScheduleCreate(date: string): void {
  scheduleDialog.value = { visible: true, date, time: '09:00', title: '', description: '' }
}

async function saveSchedule(): Promise<void> {
  const form = scheduleDialog.value
  const title = form.title.trim()
  if (!title) {
    toast.error('请填写日程标题')
    return
  }
  const time = /^([01]?\d|2[0-3]):[0-5]\d$/.test(form.time.trim()) ? form.time.trim() : '09:00'
  try {
    await window.api.schedules.create({
      date: form.date,
      time,
      title,
      description: form.description.trim(),
      done: false
    })
    scheduleDialog.value.visible = false
    await loadMonth()
    toast.success(`已添加 ${monthDayLabel(form.date)} 的日程`)
  } catch (err) {
    toast.error((err as Error).message)
  }
}

/* --------------------------- 倒数日与纪念日管理 --------------------------- */

interface AnniversaryForm {
  visible: boolean
  id?: number
  kind: 'countdown' | 'anniversary'
  name: string
  /** 起始年份（纪念日可空表示不记录年份） */
  year: number | null
  month: number
  day: number
  note: string
}

const anniDialog = ref<AnniversaryForm>({
  visible: false,
  id: undefined,
  kind: 'anniversary',
  name: '',
  year: null,
  month: 1,
  day: 1,
  note: ''
})

/** 删除确认目标（纪念日 / 倒数日） */
const anniRemoveTarget = ref<Anniversary | null>(null)

/** 倒数日可选年份范围（今年前后 10 年） */
const yearOptions = computed(() => {
  const current = todayDate.getFullYear()
  return Array.from({ length: 21 }, (_, i) => current - 10 + i)
})

const anniDayOptions = computed(() => {
  const max = new Date(2024, anniDialog.value.month, 0).getDate()
  return Array.from({ length: max }, (_, i) => i + 1)
})

watch(
  () => anniDialog.value.month,
  () => {
    const max = anniDayOptions.value.length
    if (anniDialog.value.day > max) anniDialog.value.day = max
  }
)

function openAnniversaryCreate(kind: 'countdown' | 'anniversary', date: string): void {
  const d = parseDate(date)
  anniDialog.value = {
    visible: true,
    id: undefined,
    kind,
    name: '',
    year: kind === 'countdown' ? d.getFullYear() : null,
    month: d.getMonth() + 1,
    day: d.getDate(),
    note: ''
  }
}

function openAnniversaryEdit(item: Anniversary): void {
  anniDialog.value = {
    visible: true,
    id: item.id,
    kind: item.kind,
    name: item.name,
    year: item.year,
    month: item.month,
    day: item.day,
    note: item.note
  }
}

async function saveAnniversary(): Promise<void> {
  const form = anniDialog.value
  const payload: AnniversaryInput = {
    id: form.id,
    name: form.name,
    kind: form.kind,
    year: form.year,
    month: form.month,
    day: form.day,
    note: form.note
  }
  try {
    await window.api.anniversaries.save(payload)
    anniDialog.value.visible = false
    await loadAnniversaries()
    toast.success(form.id ? '已更新' : form.kind === 'countdown' ? '倒数日已添加' : '纪念日已添加')
  } catch (err) {
    toast.error((err as Error).message)
  }
}

async function confirmRemoveAnniversary(): Promise<void> {
  const target = anniRemoveTarget.value
  if (!target) return
  try {
    await window.api.anniversaries.remove(target.id)
    anniRemoveTarget.value = null
    await loadAnniversaries()
    toast.push(`已删除「${target.name}」`, 'info')
  } catch (err) {
    toast.error((err as Error).message)
  }
}

/** 全部倒数日 / 纪念日按临近程度排序（含已过去的倒数日） */
const anniversaryItems = computed(() =>
  anniversaries.value
    .map((item) => ({
      item,
      nextDate: nextOccurrence(item, today),
      days: daysUntilOccurrence(item, today),
      yearCount: upcomingYearCount(item, today)
    }))
    .sort((a, b) => a.days - b.days)
)

/** 纪念日的日期标签（如「10月9日 · 第 3 年」） */
function anniversarySub(item: (typeof anniversaryItems.value)[number]): string {
  const base = item.item.kind === 'countdown' ? item.nextDate : monthDayLabel(item.nextDate)
  const parts = [base, untilText(item.days)]
  if (item.yearCount !== null) parts.push(`第 ${item.yearCount} 周年`)
  if (item.item.note) parts.push(item.item.note)
  return parts.join(' · ')
}
</script>

<template>
  <div class="page">
    <header class="page-head">
      <div class="head-left">
        <span class="head-icon"><Icon name="calendarDays" :size="17" /></span>
        <div class="head-text">
          <h1>日历</h1>
          <p>节假日、农历、日程与生日提醒，右键日期快速添加</p>
        </div>
      </div>
      <div class="date-nav">
        <button class="icon-btn" title="上一月" @click="shiftMonth(-1)">
          <Icon name="chevronLeft" :size="14" />
        </button>
        <span class="month-label">{{ monthLabel }}</span>
        <button class="icon-btn" title="下一月" @click="shiftMonth(1)">
          <Icon name="chevronRight" :size="14" />
        </button>
        <button class="btn btn-ghost btn-sm" @click="goToday">回到今天</button>
      </div>
    </header>

    <section class="cal-grid">
      <!-- 月视图 -->
      <div class="card month-card">
        <!-- 未来一周天气 -->
        <div class="card-header">
          <span class="card-title"><Icon name="cloud" :size="15" />未来一周天气</span>
          <span v-if="weather" class="card-sub weather-location">
            <Icon name="mapPin" :size="11" />{{ weather.location }}
          </span>
          <span v-if="weather" class="card-sub">更新于 {{ weather.updatedAt.slice(11) }}</span>
          <button class="card-action" :disabled="weatherLoading" @click="loadWeather(true)">
            <Icon name="refresh" :size="12" />{{ weatherLoading ? '刷新中' : '刷新' }}
          </button>
        </div>
        <div v-if="weather && weather.days.length > 0" class="weather-row">
          <div
            v-for="(day, index) in weather.days"
            :key="day.date"
            class="weather-day"
            :class="{ today: day.date === today }"
          >
            <span class="wd-day">{{ index === 0 ? '今天' : weekdayLabel(day.date) }}</span>
            <span class="wd-icon">{{ day.icon }}</span>
            <span class="wd-text">{{ day.text }}</span>
            <span class="wd-temp">{{ day.tempMin }}° ~ {{ day.tempMax }}°</span>
          </div>
        </div>
        <div v-else-if="weatherLoading" class="empty slim">
          <span>正在获取天气…</span>
        </div>
        <div v-else class="empty slim">
          <Icon name="cloud" :size="20" />
          <span>{{ weatherError || '暂无天气数据' }}</span>
          <button class="btn btn-ghost btn-sm" @click="loadWeather(true)">
            <Icon name="refresh" :size="12" />重试
          </button>
        </div>
        <p v-if="weather?.stale" class="hint">
          <Icon name="info" :size="12" />网络不可用，当前展示最近一次缓存数据
        </p>
        <div class="weather-divider"></div>

        <div class="weekday-row">
          <span v-for="w in WEEKDAYS" :key="w" class="weekday" :class="{ rest: w === '六' || w === '日' }">
            {{ w }}
          </span>
        </div>
        <div class="day-grid">
          <button
            v-for="cell in cells"
            :key="cell.date"
            class="cell"
            :class="{
              outside: !cell.inMonth,
              today: cell.isToday,
              selected: cell.isSelected,
              rest: cell.weekend
            }"
            :title="cellTitle(cell)"
            @click="selectDate(cell.date)"
            @contextmenu.prevent="openMenu(cell, $event)"
          >
            <span class="cell-top">
              <span class="cell-day">{{ cell.dayNumber }}</span>
              <span
                v-if="cell.holiday"
                class="cell-holiday"
                :class="cell.holiday.type === 'off' ? 'off' : 'work'"
              >
                {{ cell.holiday.type === 'off' ? '休' : '班' }}
              </span>
            </span>
            <span class="cell-sub" :class="cellSub(cell).tone">{{ cellSub(cell).text }}</span>
            <span class="cell-dots">
              <i v-if="cell.schedules.length > 0" class="dot sched"></i>
              <i v-if="cell.birthdays.length > 0" class="dot birth"></i>
              <i v-if="cell.anniversaries.length > 0" class="dot anni"></i>
              <span v-if="cell.mood !== null" class="cell-mood">{{ moodEmoji(cell.mood) }}</span>
            </span>
          </button>
        </div>
        <div class="legend">
          <span class="legend-item"><i class="dot sched"></i>日程</span>
          <span class="legend-item"><i class="dot birth"></i>生日</span>
          <span class="legend-item"><i class="dot anni"></i>倒数日 / 纪念日</span>
          <span class="legend-item"><span class="mood-sample">🙂</span>当日心情</span>
          <span class="legend-item"><span class="cell-holiday off">休</span>法定休假</span>
          <span class="legend-item"><span class="cell-holiday work">班</span>调休上班</span>
          <span class="legend-item legend-tip"><Icon name="info" :size="11" />右键日期可快速添加</span>
        </div>
      </div>

      <!-- 侧栏：选中日详情 + 生日管理 -->
      <div class="side-col">
        <div class="card">
          <div class="card-header">
            <span class="card-title"><Icon name="sun" :size="15" />{{ selectedLabel }}</span>
            <span v-if="selected === today" class="tag">今天</span>
          </div>
          <div class="day-tags">
            <span class="tag tag-plain">农历{{ selectedDay.lunar.text }}</span>
            <span class="tag tag-plain">{{ selectedDay.lunar.yearName }}年</span>
            <span v-if="selectedDay.jieQi" class="tag tag-blue">{{ selectedDay.jieQi }}</span>
            <span
              v-if="selectedDay.holiday"
              class="tag"
              :class="selectedDay.holiday.type === 'off' ? 'tag-red' : 'tag-yellow'"
            >
              {{ selectedDay.holiday.name }}{{ selectedDay.holiday.type === 'off' ? ' 休假' : ' 补班' }}
            </span>
            <span v-for="f in selectedDay.festivals" :key="f" class="tag tag-yellow">{{ f }}</span>
          </div>

          <div class="section-title">
            <span><Icon name="sun" :size="13" />心情</span>
            <span class="card-sub">{{ selectedMood === null ? '未记录' : moodLabel(selectedMood) }}</span>
          </div>
          <MoodPicker :model-value="selectedMood" size="sm" @update:model-value="setMood" />

          <div class="section-title">
            <span><Icon name="clock" :size="13" />日程</span>
            <span class="card-sub">{{ selectedSchedules.length }} 项</span>
          </div>
          <div v-if="selectedSchedules.length === 0" class="empty slim">
            <Icon name="clock" :size="20" />
            <span>这一天没有日程安排</span>
          </div>
          <div v-else class="row-list">
            <div v-for="item in selectedSchedules" :key="item.id" class="row">
              <span class="row-time">{{ item.time }}</span>
              <div class="row-main">
                <span class="row-title" :class="{ strike: item.done }">{{ item.title }}</span>
                <span v-if="item.description" class="row-desc">{{ item.description }}</span>
              </div>
              <button
                class="round-check"
                :class="{ checked: item.done }"
                :title="item.done ? '标记为未完成' : '标记为完成'"
                @click="toggleSchedule(item)"
              >
                <Icon name="check" :size="11" />
              </button>
            </div>
          </div>

          <template v-if="selectedBirthdays.length > 0">
            <div class="section-title">
              <span><Icon name="gift" :size="13" />生日</span>
            </div>
            <div class="row-list">
              <div v-for="item in selectedBirthdays" :key="item.id" class="row">
                <span class="birth-icon"><Icon name="gift" :size="13" /></span>
                <span class="row-title">{{ item.name }}</span>
                <span class="tag tag-yellow">{{ dateLabel(item) }}</span>
              </div>
            </div>
          </template>

          <template v-if="selectedAnniversaries.length > 0">
            <div class="section-title">
              <span><Icon name="cake" :size="13" />倒数日 / 纪念日</span>
            </div>
            <div class="row-list">
              <div v-for="item in selectedAnniversaries" :key="item.id" class="row">
                <span class="anni-icon" :class="item.kind">
                  <Icon :name="item.kind === 'countdown' ? 'hourglass' : 'cake'" :size="13" />
                </span>
                <span class="row-title">{{ item.name }}</span>
                <span class="tag" :class="item.kind === 'countdown' ? 'tag-blue' : 'tag-red'">
                  {{ item.kind === 'countdown' ? '倒数日' : '纪念日' }}
                </span>
              </div>
            </div>
          </template>
        </div>

        <!-- 生日管理 -->
        <div class="card">
          <div class="card-header">
            <span class="card-title"><Icon name="gift" :size="15" />生日管理</span>
            <span class="card-sub">共 {{ birthdayItems.length }} 位</span>
            <button class="card-action" @click="openCreate()">
              <Icon name="plus" :size="12" />添加生日
            </button>
          </div>
          <div v-if="birthdayItems.length === 0" class="empty">
            <Icon name="gift" :size="24" />
            <span>还没有生日记录，点击「添加生日」开始</span>
          </div>
          <div v-else class="birth-list">
            <div v-for="item in birthdayItems" :key="item.birthday.id" class="birth-item">
              <span class="birth-icon"><Icon name="gift" :size="14" /></span>
              <div class="birth-main">
                <span class="birth-name">
                  {{ item.birthday.name }}
                  <span class="tag tag-plain">{{ item.birthday.calendar === 'lunar' ? '农历' : '公历' }}</span>
                  <span v-if="item.daysUntil <= item.birthday.remindDays" class="tag tag-red">
                    {{ item.daysUntil === 0 ? '今天生日' : '提醒中' }}
                  </span>
                </span>
                <span class="birth-sub">
                  {{ dateLabel(item.birthday) }} · {{ item.nextDate }}（{{ untilLabel(item.daysUntil) }}）
                  <template v-if="item.birthday.note">· {{ item.birthday.note }}</template>
                </span>
              </div>
              <div class="birth-actions">
                <button class="icon-btn" title="编辑" @click="openEdit(item.birthday)">
                  <Icon name="edit" :size="13" />
                </button>
                <button class="icon-btn danger" title="删除" @click="removeTarget = item.birthday">
                  <Icon name="trash" :size="13" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 倒数日与纪念日 -->
        <div class="card">
          <div class="card-header">
            <span class="card-title"><Icon name="cake" :size="15" />倒数日与纪念日</span>
            <span class="card-sub">共 {{ anniversaryItems.length }} 项</span>
            <button class="card-action" @click="openAnniversaryCreate('countdown', selected)">
              <Icon name="hourglass" :size="12" />倒数日
            </button>
            <button class="card-action" @click="openAnniversaryCreate('anniversary', selected)">
              <Icon name="plus" :size="12" />纪念日
            </button>
          </div>
          <div v-if="anniversaryItems.length === 0" class="empty">
            <Icon name="hourglass" :size="24" />
            <span>还没有倒数日或纪念日，右键日期可快速添加</span>
          </div>
          <div v-else class="birth-list">
            <div v-for="entry in anniversaryItems" :key="entry.item.id" class="birth-item">
              <span class="anni-icon" :class="entry.item.kind">
                <Icon :name="entry.item.kind === 'countdown' ? 'hourglass' : 'cake'" :size="14" />
              </span>
              <div class="birth-main">
                <span class="birth-name">
                  {{ entry.item.name }}
                  <span class="tag" :class="entry.item.kind === 'countdown' ? 'tag-blue' : 'tag-red'">
                    {{ entry.item.kind === 'countdown' ? '倒数日' : '纪念日' }}
                  </span>
                  <span v-if="entry.days === 0" class="tag tag-yellow">就是今天</span>
                </span>
                <span class="birth-sub">{{ anniversarySub(entry) }}</span>
              </div>
              <div class="birth-actions">
                <button class="icon-btn" title="编辑" @click="openAnniversaryEdit(entry.item)">
                  <Icon name="edit" :size="13" />
                </button>
                <button class="icon-btn danger" title="删除" @click="anniRemoveTarget = entry.item">
                  <Icon name="trash" :size="13" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 生日编辑弹窗 -->
    <ModalDialog
      :visible="dialog.visible"
      :title="dialog.id ? '编辑生日' : '添加生日'"
      width="430px"
      @close="dialog.visible = false"
    >
      <label class="field">
        <span class="field-label">姓名 / 称呼</span>
        <input v-model="dialog.name" class="input" placeholder="例如：妈妈" maxlength="20" />
      </label>
      <div class="field">
        <span class="field-label">历法</span>
        <div class="seg">
          <button
            class="seg-btn"
            :class="{ active: dialog.calendar === 'solar' }"
            @click="dialog.calendar = 'solar'"
          >
            公历
          </button>
          <button
            class="seg-btn"
            :class="{ active: dialog.calendar === 'lunar' }"
            @click="dialog.calendar = 'lunar'"
          >
            农历
          </button>
        </div>
      </div>
      <div class="field-row">
        <label class="field">
          <span class="field-label">月份</span>
          <select v-model.number="dialog.month" class="select">
            <option v-for="m in 12" :key="m" :value="m">
              {{ dialog.calendar === 'lunar' ? lunarMonthName(m) : `${m} 月` }}
            </option>
          </select>
        </label>
        <label class="field">
          <span class="field-label">日期</span>
          <select v-model.number="dialog.day" class="select">
            <option v-for="d in dayOptions" :key="d" :value="d">
              {{ dialog.calendar === 'lunar' ? lunarDayText(d) : `${d} 日` }}
            </option>
          </select>
        </label>
        <label class="field">
          <span class="field-label">提前提醒</span>
          <select v-model.number="dialog.remindDays" class="select">
            <option v-for="opt in REMIND_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </label>
      </div>
      <label class="field">
        <span class="field-label">备注</span>
        <input v-model="dialog.note" class="input" placeholder="选填，例如：记得提前订蛋糕" maxlength="60" />
      </label>
      <p class="hint">
        <Icon name="info" :size="12" />农历生日按对应农历年自动换算为公历日期，闰月按同号月份的日期计算。
      </p>
      <template #footer>
        <button class="btn btn-plain" @click="dialog.visible = false">取消</button>
        <button class="btn btn-primary" @click="saveBirthday">保存</button>
      </template>
    </ModalDialog>

    <!-- 删除确认 -->
    <ConfirmDialog
      :visible="removeTarget !== null"
      title="删除生日"
      :message="`确定删除「${removeTarget?.name ?? ''}」的生日记录吗？删除后无法恢复。`"
      @close="removeTarget = null"
      @confirm="confirmRemove"
    />

    <!-- 添加日程弹窗（右键菜单「添加日程」） -->
    <ModalDialog
      :visible="scheduleDialog.visible"
      :title="`添加日程（${monthDayLabel(scheduleDialog.date)}）`"
      width="420px"
      @close="scheduleDialog.visible = false"
    >
      <div class="field-row">
        <label class="field">
          <span class="field-label">时间</span>
          <input v-model="scheduleDialog.time" class="input" placeholder="09:00" maxlength="5" />
        </label>
        <label class="field grow">
          <span class="field-label">标题</span>
          <input
            v-model="scheduleDialog.title"
            class="input"
            placeholder="例如：产品评审会"
            maxlength="30"
          />
        </label>
      </div>
      <label class="field">
        <span class="field-label">描述</span>
        <input
          v-model="scheduleDialog.description"
          class="input"
          placeholder="选填"
          maxlength="60"
        />
      </label>
      <template #footer>
        <button class="btn btn-plain" @click="scheduleDialog.visible = false">取消</button>
        <button class="btn btn-primary" @click="saveSchedule">保存</button>
      </template>
    </ModalDialog>

    <!-- 倒数日 / 纪念日编辑弹窗 -->
    <ModalDialog
      :visible="anniDialog.visible"
      :title="`${anniDialog.id ? '编辑' : '添加'}${anniDialog.kind === 'countdown' ? '倒数日' : '纪念日'}`"
      width="430px"
      @close="anniDialog.visible = false"
    >
      <label class="field">
        <span class="field-label">名称</span>
        <input
          v-model="anniDialog.name"
          class="input"
          :placeholder="anniDialog.kind === 'countdown' ? '例如：高考倒计时' : '例如：结婚纪念日'"
          maxlength="20"
        />
      </label>
      <div class="field-row">
        <label v-if="anniDialog.kind === 'countdown'" class="field">
          <span class="field-label">年份</span>
          <select v-model.number="anniDialog.year" class="select">
            <option v-for="y in yearOptions" :key="y" :value="y">{{ y }} 年</option>
          </select>
        </label>
        <label class="field">
          <span class="field-label">月份</span>
          <select v-model.number="anniDialog.month" class="select">
            <option v-for="m in 12" :key="m" :value="m">{{ m }} 月</option>
          </select>
        </label>
        <label class="field">
          <span class="field-label">日期</span>
          <select v-model.number="anniDialog.day" class="select">
            <option v-for="d in anniDayOptions" :key="d" :value="d">{{ d }} 日</option>
          </select>
        </label>
      </div>
      <label v-if="anniDialog.kind === 'anniversary'" class="field">
        <span class="field-label">起始年份（选填，用于计算周年）</span>
        <select v-model="anniDialog.year" class="select">
          <option :value="null">不记录年份</option>
          <option v-for="y in yearOptions" :key="y" :value="y">{{ y }} 年</option>
        </select>
      </label>
      <label class="field">
        <span class="field-label">备注</span>
        <input v-model="anniDialog.note" class="input" placeholder="选填" maxlength="60" />
      </label>
      <p v-if="anniDialog.kind === 'anniversary'" class="hint">
        <Icon name="info" :size="12" />纪念日每年重复提醒；倒数日为一次性日期，到达后显示「已过 N 天」。
      </p>
      <template #footer>
        <button class="btn btn-plain" @click="anniDialog.visible = false">取消</button>
        <button class="btn btn-primary" @click="saveAnniversary">保存</button>
      </template>
    </ModalDialog>

    <!-- 删除确认（倒数日 / 纪念日） -->
    <ConfirmDialog
      :visible="anniRemoveTarget !== null"
      :title="anniRemoveTarget?.kind === 'countdown' ? '删除倒数日' : '删除纪念日'"
      :message="`确定删除「${anniRemoveTarget?.name ?? ''}」吗？删除后无法恢复。`"
      @close="anniRemoveTarget = null"
      @confirm="confirmRemoveAnniversary"
    />

    <!-- 日期右键菜单 -->
    <Teleport to="body">
      <div
        v-if="menu.visible"
        class="ctx-overlay"
        @click="closeMenu"
        @contextmenu.prevent="closeMenu"
      >
        <div class="ctx-menu" :style="{ left: `${menu.x}px`, top: `${menu.y}px` }" @click.stop>
          <p class="ctx-title">{{ monthDayLabel(menu.date) }} {{ weekdayLabel(menu.date) }}</p>
          <button class="ctx-item" @click="menuAction('birthday')">
            <Icon name="gift" :size="13" />添加生日
          </button>
          <button class="ctx-item" @click="menuAction('schedule')">
            <Icon name="clock" :size="13" />添加日程
          </button>
          <button class="ctx-item" @click="menuAction('countdown')">
            <Icon name="hourglass" :size="13" />倒数日
          </button>
          <button class="ctx-item" @click="menuAction('anniversary')">
            <Icon name="cake" :size="13" />纪念日
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.head-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.head-icon {
  width: 34px;
  height: 34px;
  border-radius: 11px;
  background: linear-gradient(135deg, var(--green-500), var(--green-600));
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 10px var(--brand-shadow);
}

.head-text h1 {
  font-size: 16px;
  font-weight: 800;
}

.head-text p {
  font-size: 11.5px;
  color: var(--text-3);
  margin-top: 1px;
}

.date-nav {
  display: flex;
  align-items: center;
  gap: 6px;
}

.month-label {
  min-width: 86px;
  text-align: center;
  font-size: 13.5px;
  font-weight: 800;
}

/* ------------------------------ 布局 ------------------------------ */
.cal-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.side-col {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

/* ------------------------------ 未来一周天气 ------------------------------ */
.weather-location {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.weather-location .icon {
  color: var(--green-600);
}

.card-action:disabled {
  opacity: 0.6;
  cursor: default;
  background: transparent;
}

.weather-row {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
}

.weather-day {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 9px 4px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-soft);
}

.weather-day.today {
  border-color: var(--green-500);
  background: var(--green-50);
}

.wd-day {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--text-2);
}

.weather-day.today .wd-day {
  color: var(--green-700);
}

.wd-icon {
  font-size: 18px;
  line-height: 1.2;
}

.wd-text {
  font-size: 10.5px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.wd-temp {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-1);
}

.weather-divider {
  margin: 14px 0 4px;
  border-top: 1px dashed var(--border);
}

/* ------------------------------ 月视图 ------------------------------ */
.weekday-row {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
  margin-bottom: 6px;
}

.weekday {
  text-align: center;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--text-2);
  padding: 4px 0;
}

.weekday.rest {
  color: var(--red);
}

.day-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}

.cell {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 2px;
  height: 66px;
  padding: 5px 6px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: var(--surface-soft);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.13s, border-color 0.13s, box-shadow 0.13s;
}

.cell:hover {
  border-color: var(--green-200);
  background: var(--green-50);
}

.cell.outside {
  opacity: 0.45;
}

.cell.today {
  border-color: var(--green-500);
  background: var(--green-50);
}

.cell.selected {
  background: var(--green-100);
  border-color: var(--green-500);
  box-shadow: inset 0 0 0 1px var(--green-500);
}

.cell-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2px;
}

.cell-day {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
  line-height: 1.25;
}

.cell.rest .cell-day {
  color: var(--red);
}

.cell.today .cell-day {
  color: var(--green-700);
}

.cell-holiday {
  flex: none;
  width: 15px;
  height: 15px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.cell-holiday.off {
  background: var(--red-soft);
  color: var(--red);
}

.cell-holiday.work {
  background: var(--blue-soft);
  color: var(--blue-ink);
}

.cell-sub {
  font-size: 10px;
  line-height: 1.3;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cell-sub.festival {
  color: var(--red);
}

.cell-sub.jieqi {
  color: var(--blue-ink);
}

.cell-dots {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-top: auto;
  height: 14px;
}

.cell-mood {
  margin-left: auto;
  font-size: 12px;
  line-height: 1;
}

.mood-sample {
  font-size: 12px;
  line-height: 1;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
}

.dot.sched {
  background: var(--green-500);
}

.dot.birth {
  background: var(--yellow);
}

.dot.anni {
  background: var(--rose, #e11d48);
}

.legend-tip {
  margin-left: auto;
  color: var(--text-3);
}

.legend {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--border);
  font-size: 11px;
  color: var(--text-3);
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

/* ------------------------------ 侧栏详情 ------------------------------ */
.day-tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 10px 0 6px;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-1);
}

.section-title > span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.section-title .icon {
  color: var(--green-600);
}

.section-title .card-sub {
  font-weight: 400;
}

.row-list {
  display: flex;
  flex-direction: column;
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 2px;
  border-bottom: 1px dashed var(--border);
}

.row:last-child {
  border-bottom: none;
}

.row-time {
  width: 42px;
  flex: none;
  font-size: 12.5px;
  font-weight: 800;
  color: var(--green-600);
}

.row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.row-title {
  font-size: 12.8px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-desc {
  font-size: 11.5px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-title.strike {
  text-decoration: line-through;
  color: var(--text-3);
}

.empty.slim {
  padding: 14px 6px;
}

.birth-icon {
  width: 28px;
  height: 28px;
  flex: none;
  border-radius: 9px;
  background: var(--yellow-soft);
  color: var(--yellow-ink);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* 倒数日 / 纪念日图标徽章 */
.anni-icon {
  width: 28px;
  height: 28px;
  flex: none;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.anni-icon.countdown {
  background: var(--blue-soft);
  color: var(--blue-ink);
}

.anni-icon.anniversary {
  background: var(--red-soft);
  color: var(--red);
}

/* ------------------------------ 日期右键菜单 ------------------------------ */
.ctx-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
}

.ctx-menu {
  position: fixed;
  min-width: 160px;
  padding: 6px;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.22);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ctx-title {
  padding: 4px 10px 6px;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-3);
  border-bottom: 1px dashed var(--border);
  margin-bottom: 4px;
}

.ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-1);
  cursor: pointer;
  text-align: left;
  transition: background 0.12s, color 0.12s;
}

.ctx-item:hover {
  background: var(--green-100);
  color: var(--green-700);
}

.ctx-item .icon {
  color: var(--green-600);
}

.field.grow {
  flex: 1;
}

/* ------------------------------ 生日列表 ------------------------------ */
.birth-list {
  display: flex;
  flex-direction: column;
}

.birth-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 2px;
  border-bottom: 1px dashed var(--border);
}

.birth-item:last-child {
  border-bottom: none;
}

.birth-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.birth-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
}

.birth-sub {
  font-size: 11.5px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.birth-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: none;
}

.hint {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  margin-top: 10px;
  font-size: 11px;
  color: var(--text-3);
  line-height: 1.5;
}

.hint .icon {
  margin-top: 2px;
}

/* ------------------------------ 弹窗表单 ------------------------------ */
.seg {
  display: inline-flex;
  padding: 3px;
  gap: 3px;
  border-radius: 999px;
  background: var(--plain-bg);
  width: fit-content;
}

.seg-btn {
  border: none;
  border-radius: 999px;
  padding: 5px 18px;
  font-size: 12.5px;
  font-family: inherit;
  font-weight: 600;
  color: var(--text-2);
  background: transparent;
  cursor: pointer;
  transition: all 0.15s;
}

.seg-btn.active {
  background: var(--surface);
  color: var(--green-700);
  box-shadow: var(--shadow-card);
}

/* ------------------------------ 响应式 ------------------------------ */
@media (max-width: 1160px) {
  .cal-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 700px) {
  .cell {
    height: 58px;
    padding: 4px;
  }

  .weather-row {
    gap: 4px;
  }

  .weather-day {
    padding: 7px 2px;
  }

  .wd-text {
    display: none;
  }

  .cell-sub {
    font-size: 9px;
  }

  .legend {
    gap: 8px;
  }
}
</style>