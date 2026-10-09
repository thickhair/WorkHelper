/**
 * 日历模块测试：农历换算（对比官方公布日期）、节日与节气、法定节假日/调休、
 * 生日（含农历与闰月）的下次发生日计算。
 */
import { describe, expect, it } from 'vitest'
import {
  birthdayDateLabel,
  birthdayDatesInRange,
  calendarDayOf,
  daysUntilBirthday,
  festivalsOf,
  holidayOf,
  isBirthdayOn,
  lunarOf,
  nextBirthdayDate
} from '@shared/calendar'
import { HOLIDAY_MAP, HOLIDAY_YEARS } from '@shared/holidays'

describe('农历换算', () => {
  it('春节（正月初一）与官方公布日期一致', () => {
    expect(lunarOf('2024-02-10').text).toBe('正月初一')
    expect(lunarOf('2025-01-29').text).toBe('正月初一')
    expect(lunarOf('2026-02-17').text).toBe('正月初一')
    expect(lunarOf('2027-02-06').text).toBe('正月初一')
  })

  it('中秋（八月十五）与闰月识别正确', () => {
    expect(lunarOf('2026-09-25').text).toBe('八月十五')
    expect(lunarOf('2027-09-15').text).toBe('八月十五')
    expect(lunarOf('2025-07-25').monthName).toBe('闰六月')
    expect(lunarOf('2025-07-25').leap).toBe(true)
  })

  it('干支年名、年月日与节气可解析', () => {
    const day = lunarOf('2026-10-09')
    expect(day.yearName).toBe('丙午')
    expect(day.month).toBe(8)
    expect(day.day).toBe(29)
    expect(lunarOf('2026-10-08').jieQi).toBe('寒露')
    expect(lunarOf('2026-10-09').jieQi).toBe('')
  })
})

describe('节日与法定节假日', () => {
  it('农历与公历节日识别', () => {
    expect(festivalsOf('2026-02-17')).toContain('春节')
    expect(festivalsOf('2026-02-16')).toContain('除夕')
    expect(festivalsOf('2026-09-25')).toContain('中秋节')
    expect(festivalsOf('2026-10-01')).toContain('国庆节')
  })

  it('法定放假与调休标记（源自国务院办公厅通知）', () => {
    expect(holidayOf('2026-02-15')).toEqual({ name: '春节', type: 'off' })
    expect(holidayOf('2026-02-23')).toEqual({ name: '春节', type: 'off' })
    expect(holidayOf('2026-02-14')).toEqual({ name: '春节', type: 'work' })
    expect(holidayOf('2026-09-20')).toEqual({ name: '国庆节', type: 'work' })
    expect(holidayOf('2026-10-10')).toEqual({ name: '国庆节', type: 'work' })
    expect(holidayOf('2025-10-08')).toEqual({ name: '国庆节、中秋节', type: 'off' })
    expect(HOLIDAY_YEARS).toEqual([2023, 2024, 2025, 2026])
    expect(HOLIDAY_MAP.size).toBeGreaterThan(80)
  })

  it('普通日期无节假日标记', () => {
    expect(holidayOf('2026-03-03')).toBeUndefined()
  })
})

describe('生日（含农历）', () => {
  it('公历生日：2 月 29 日在平年按 2 月 28 日计算', () => {
    const b = { calendar: 'solar' as const, month: 2, day: 29 }
    expect(isBirthdayOn(b, '2024-02-29')).toBe(true)
    expect(isBirthdayOn(b, '2024-02-28')).toBe(false)
    expect(isBirthdayOn(b, '2025-02-28')).toBe(true)
    expect(isBirthdayOn(b, '2025-03-01')).toBe(false)
  })

  it('农历生日按农历年换算为公历（中秋八月十五）', () => {
    const b = { calendar: 'lunar' as const, month: 8, day: 15 }
    expect(isBirthdayOn(b, '2026-09-25')).toBe(true)
    expect(isBirthdayOn(b, '2026-09-24')).toBe(false)
    expect(nextBirthdayDate(b, '2026-10-09')).toBe('2027-09-15')
  })

  it('闰月生日按同号的非闰月计算', () => {
    const b = { calendar: 'lunar' as const, month: 6, day: 1 }
    expect(isBirthdayOn(b, '2025-06-25')).toBe(true)
    expect(isBirthdayOn(b, '2025-07-25')).toBe(false)
  })

  it('农历三十在 29 天的月份按当月最后一天计算', () => {
    const b = { calendar: 'lunar' as const, month: 12, day: 30 }
    expect(isBirthdayOn(b, '2027-02-05')).toBe(true)
    expect(isBirthdayOn(b, '2027-02-04')).toBe(false)
  })

  it('距下一次生日天数与下次日期', () => {
    const b = { calendar: 'solar' as const, month: 10, day: 9 }
    expect(daysUntilBirthday(b, '2026-10-09')).toBe(0)
    expect(daysUntilBirthday(b, '2026-10-10')).toBe(364)
    expect(nextBirthdayDate(b, '2026-10-10')).toBe('2027-10-09')
  })

  it('区间内生日日期（用于日历标记）', () => {
    const b = { calendar: 'solar' as const, month: 10, day: 9 }
    expect(birthdayDatesInRange(b, '2026-10-01', '2026-10-31')).toEqual(['2026-10-09'])
  })

  it('生日文案', () => {
    expect(birthdayDateLabel({ calendar: 'solar', month: 10, day: 9 })).toBe('10月9日')
    expect(birthdayDateLabel({ calendar: 'lunar', month: 8, day: 15 })).toBe('八月十五')
  })
})

describe('日历单日信息', () => {
  it('包含周末、农历、节日、节气与节假日标记', () => {
    const day = calendarDayOf('2026-10-01')
    expect(day.weekend).toBe(false)
    expect(day.festivals).toContain('国庆节')
    expect(day.holiday).toEqual({ name: '国庆节', type: 'off' })
    expect(day.lunar.month).toBe(8)
    expect(day.jieQi).toBe('')
  })
})