/**
 * 倒数日与纪念日共享模块：类型定义、下一次发生日期与剩余天数计算。
 * - 倒数日（countdown）：指向某个确定日期（含年），到达后显示「已过 N 天」；
 * - 纪念日（anniversary）：每年重复（月 / 日），year 可空（空表示不记录起始年份）。
 */
import { addDays, formatDate, parseDate } from './logic'

/** 纪念日 / 倒数日记录 */
export interface Anniversary {
  id: number
  name: string
  /** countdown = 倒数日（一次性日期）；anniversary = 纪念日（每年重复） */
  kind: 'countdown' | 'anniversary'
  /** 起始年份（倒数日必填；纪念日可空，空表示不计算周年数） */
  year: number | null
  month: number
  day: number
  note: string
  createdAt: string
}

/** 新增 / 编辑输入 */
export type AnniversaryInput = Omit<Anniversary, 'id' | 'createdAt'> & { id?: number }

/** 校验并规范化输入（非法值抛出错说明） */
export function normalizeAnniversary(input: AnniversaryInput): AnniversaryInput {
  const name = (input.name ?? '').trim()
  if (!name) throw new Error('请填写名称')
  const kind = input.kind === 'countdown' ? 'countdown' : 'anniversary'
  const month = Math.round(Number(input.month))
  const day = Math.round(Number(input.day))
  if (!Number.isFinite(month) || month < 1 || month > 12) throw new Error('月份需在 1-12 之间')
  const maxDay = new Date(2024, month, 0).getDate()
  if (!Number.isFinite(day) || day < 1 || day > maxDay) throw new Error(`日期需在 1-${maxDay} 之间`)
  let year: number | null = null
  if (input.year !== null && input.year !== undefined && input.year !== ('' as never)) {
    const y = Math.round(Number(input.year))
    if (!Number.isFinite(y) || y < 1900 || y > 2200) throw new Error('年份需在 1900-2200 之间')
    year = y
  }
  if (kind === 'countdown' && year === null) throw new Error('倒数日需要选择完整日期（含年份）')
  return {
    id: input.id,
    name,
    kind,
    year,
    month,
    day,
    note: (input.note ?? '').trim()
  }
}

/** 以 year 年发生的公历日期（纪念日按当年换算，2 月 29 日在平年回退为 2 月 28 日） */
export function occurrenceInYear(item: Pick<Anniversary, 'month' | 'day'>, year: number): string {
  const maxDay = new Date(year, item.month, 0).getDate()
  const day = Math.min(item.day, maxDay)
  return formatDate(new Date(year, item.month - 1, day))
}

/**
 * 下一次发生的公历日期：
 * - 倒数日：即其目标日期（过去后也返回该日期，由调用方判断「已过」）；
 * - 纪念日：今天之前的最近一次若已过去，则取明年，否则取今年。
 */
export function nextOccurrence(item: Anniversary, today: string): string {
  if (item.kind === 'countdown') {
    return occurrenceInYear(item, item.year ?? parseDate(today).getFullYear())
  }
  const year = parseDate(today).getFullYear()
  const thisYear = occurrenceInYear(item, year)
  return thisYear >= today ? thisYear : occurrenceInYear(item, year + 1)
}

/** 距下一次发生的天数（0 = 今天；负数表示倒数日已过去的天数取负） */
export function daysUntilOccurrence(item: Anniversary, today: string): number {
  const next = nextOccurrence(item, today)
  let diff = 0
  let cursor = today
  if (next >= today) {
    while (cursor < next) {
      diff += 1
      cursor = addDays(cursor, 1)
    }
    return diff
  }
  while (cursor > next) {
    diff -= 1
    cursor = addDays(cursor, -1)
  }
  return diff
}

/** 到达下一次发生时是第几周年（纪念日且记录了起始年份时可用，否则为 null） */
export function upcomingYearCount(item: Anniversary, today: string): number | null {
  if (item.kind !== 'anniversary' || item.year === null) return null
  const next = nextOccurrence(item, today)
  const count = parseDate(next).getFullYear() - item.year
  return count > 0 ? count : null
}

/** 剩余天数的展示文案 */
export function untilText(days: number): string {
  if (days === 0) return '就是今天'
  if (days === 1) return '明天'
  if (days > 1) return `还有 ${days} 天`
  return `已过 ${-days} 天`
}
