/**
 * 日历共享模块：农历与干支、公历/农历节日、节气（基于 lunar-javascript 精确历法数据）、
 * 法定节假日与调休查询，以及生日（支持农历）的下次发生日计算。
 * 主进程（生日提醒）与渲染进程（日历页）共用，也可在单元测试中直接使用。
 */
import { HolidayUtil, Lunar, Solar } from 'lunar-javascript'
import { formatDate, parseDate } from './logic'
import { holidayOf as tableHolidayOf, type HolidayDay } from './holidays'

/** 农历日信息 */
export interface LunarDay {
  /** 农历年（数字） */
  year: number
  /** 农历年干支（如「丙午」） */
  yearName: string
  /** 农历月名（如「八月」「闰六月」） */
  monthName: string
  /** 农历月序号：正月 1 … 腊月 12（闰月与本月同号） */
  month: number
  /** 农历日：1-30 */
  day: number
  /** 是否闰月 */
  leap: boolean
  /** 农历日中文（初一 / 十五 / 廿九） */
  dayText: string
  /** 农历完整文本（如「八月廿九」「闰六月初一」） */
  text: string
  /** 节气名（非节气日为空字符串） */
  jieQi: string
}

/** 农历月名（1-12，不含闰月前缀） */
const LUNAR_MONTH_NAMES = [
  '正月',
  '二月',
  '三月',
  '四月',
  '五月',
  '六月',
  '七月',
  '八月',
  '九月',
  '十月',
  '冬月',
  '腊月'
]

/** 农历日中文列表（1-30） */
const LUNAR_DAY_TEXTS = [
  '初一',
  '初二',
  '初三',
  '初四',
  '初五',
  '初六',
  '初七',
  '初八',
  '初九',
  '初十',
  '十一',
  '十二',
  '十三',
  '十四',
  '十五',
  '十六',
  '十七',
  '十八',
  '十九',
  '二十',
  '廿一',
  '廿二',
  '廿三',
  '廿四',
  '廿五',
  '廿六',
  '廿七',
  '廿八',
  '廿九',
  '三十'
]

/** 农历月名（1-12） */
export function lunarMonthName(month: number): string {
  return LUNAR_MONTH_NAMES[month - 1] ?? ''
}

/** 农历日中文（1-30） */
export function lunarDayText(day: number): string {
  return LUNAR_DAY_TEXTS[day - 1] ?? ''
}

const lunarCache = new Map<string, LunarDay>()

function solarOf(date: string): Solar {
  const parsed = parseDate(date)
  return Solar.fromYmd(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate())
}

/** 公历日期（`YYYY-MM-DD`）→ 农历信息（带缓存） */
export function lunarOf(date: string): LunarDay {
  const cached = lunarCache.get(date)
  if (cached) return cached
  const lunar = solarOf(date).getLunar()
  const rawMonth = lunar.getMonth()
  const leap = rawMonth < 0
  const month = Math.abs(rawMonth)
  const day = lunar.getDay()
  const monthName = `${lunar.getMonthInChinese()}月`
  const dayText = lunar.getDayInChinese()
  const result: LunarDay = {
    year: lunar.getYear(),
    yearName: lunar.getYearInGanZhi(),
    monthName,
    month,
    day,
    leap,
    dayText,
    text: `${monthName}${dayText}`,
    jieQi: lunar.getJieQi()
  }
  if (lunarCache.size > 4000) lunarCache.clear()
  lunarCache.set(date, result)
  return result
}

/** 某天的节日列表（公历节日 + 农历节日，含除夕） */
export function festivalsOf(date: string): string[] {
  const solar = solarOf(date)
  return Array.from(new Set([...solar.getFestivals(), ...solar.getLunar().getFestivals()]))
}

/**
 * 查询某天的法定节假日 / 调休信息。
 * 优先使用内置的国务院办公厅通知数据（2024-2026），未收录年份回退到日历库数据。
 */
export function holidayOf(date: string): HolidayDay | undefined {
  const fromTable = tableHolidayOf(date)
  if (fromTable) return fromTable
  const fromLib = HolidayUtil.getHoliday(date)
  if (!fromLib) return undefined
  return { name: fromLib.getName(), type: fromLib.isWork() ? 'work' : 'off' }
}

/** 日历单日信息 */
export interface CalendarDay {
  date: string
  /** 是否周末 */
  weekend: boolean
  lunar: LunarDay
  /** 节日（公历 + 农历，含除夕） */
  festivals: string[]
  /** 法定节假日 / 调休信息 */
  holiday?: HolidayDay
  /** 节气名（非节气日为空字符串） */
  jieQi: string
}

/** 组装某天的日历信息（周末、农历、节日、节气、法定节假日） */
export function calendarDayOf(date: string): CalendarDay {
  const week = parseDate(date).getDay()
  const lunar = lunarOf(date)
  return {
    date,
    weekend: week === 0 || week === 6,
    lunar,
    festivals: festivalsOf(date),
    holiday: holidayOf(date),
    jieQi: lunar.jieQi
  }
}

/** 生日配置（与数据库字段对应的最小结构） */
export interface BirthdayLike {
  calendar: 'solar' | 'lunar'
  /** 公历 1-12；农历 1-12 */
  month: number
  /** 公历 1-31；农历 1-30 */
  day: number
}

/** 公历生日在指定年份的日期（2 月 29 日在平年按 2 月 28 日） */
function solarBirthdayDate(b: BirthdayLike, year: number): string {
  const lastDay = new Date(year, b.month, 0).getDate()
  const day = Math.min(b.day, lastDay)
  return formatDate(new Date(year, b.month - 1, day))
}

/** 农历生日在指定农历年的公历日期（农历三十在 29 天的月份按当月最后一天） */
function lunarBirthdayDate(b: BirthdayLike, lunarYear: number): string | null {
  for (let day = b.day; day >= 1; day -= 1) {
    try {
      return Lunar.fromYmd(lunarYear, b.month, day).getSolar().toYmd()
    } catch {
      // 该月天数不足时回退到前一天（仅「三十」可能触发）
    }
  }
  return null
}

/** 判断某天是否为该生日的生日当天 */
export function isBirthdayOn(b: BirthdayLike, date: string): boolean {
  if (b.calendar === 'solar') {
    const d = parseDate(date)
    if (b.month === 2 && b.day === 29) {
      const lastDay = new Date(d.getFullYear(), 2, 0).getDate()
      return d.getMonth() === 1 && d.getDate() === lastDay
    }
    return d.getMonth() + 1 === b.month && d.getDate() === b.day
  }
  return lunarBirthdayDate(b, lunarOf(date).year) === date
}

/** 返回 [from, to] 区间内该生日的所有日期 */
export function birthdayDatesInRange(b: BirthdayLike, from: string, to: string): string[] {
  const list: string[] = []
  for (let cursor = from; cursor <= to; ) {
    if (isBirthdayOn(b, cursor)) list.push(cursor)
    const next = parseDate(cursor)
    next.setDate(next.getDate() + 1)
    cursor = formatDate(next)
  }
  return list
}

/** 下一次生日的公历日期（未找到返回 null） */
export function nextBirthdayDate(b: BirthdayLike, today: string): string | null {
  if (b.calendar === 'solar') {
    const startYear = parseDate(today).getFullYear()
    for (let i = 0; i <= 1; i += 1) {
      const date = solarBirthdayDate(b, startYear + i)
      if (date >= today) return date
    }
    return null
  }
  const startLunarYear = lunarOf(today).year
  for (let i = 0; i <= 1; i += 1) {
    const date = lunarBirthdayDate(b, startLunarYear + i)
    if (date && date >= today) return date
  }
  return null
}

/** 距下一次生日的天数（0 = 今天；计算异常时返回 -1） */
export function daysUntilBirthday(b: BirthdayLike, today: string): number {
  const next = nextBirthdayDate(b, today)
  if (!next) return -1
  return Math.round((parseDate(next).getTime() - parseDate(today).getTime()) / 86400000)
}

/** 生日日期文案（公历「10月9日」/ 农历「八月十五」） */
export function birthdayDateLabel(b: BirthdayLike): string {
  if (b.calendar === 'solar') return `${b.month}月${b.day}日`
  return `${lunarMonthName(b.month)}${lunarDayText(b.day)}`
}