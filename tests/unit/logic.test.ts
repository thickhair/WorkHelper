/**
 * 共享逻辑单元测试：日期处理、进度计算、状态推导、下一个任务选取等。
 */
import { describe, expect, it } from 'vitest'
import {
  addDays,
  computeProgress,
  durationBetween,
  formatDate,
  formatMinutes,
  greetingByHour,
  habitStreak,
  isSameDay,
  monthDayLabel,
  nextTaskOf,
  parseDate,
  percent,
  recentDates,
  statusLabel,
  timeToMinutes,
  weekdayLabel
} from '@shared/logic'

describe('日期工具', () => {
  it('formatDate 输出 YYYY-MM-DD', () => {
    expect(formatDate(new Date(2026, 7, 15))).toBe('2026-08-15')
    expect(formatDate(new Date(2026, 0, 3))).toBe('2026-01-03')
  })

  it('parseDate 解析合法日期，非法输入回退为今天', () => {
    const parsed = parseDate('2026-08-15')
    expect(parsed.getFullYear()).toBe(2026)
    expect(parsed.getMonth()).toBe(7)
    expect(parsed.getDate()).toBe(15)
    expect(isSameDay(formatDate(parseDate('bad-input')), formatDate(new Date()))).toBe(true)
  })

  it('addDays 支持跨月与跨年', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('weekdayLabel / monthDayLabel 输出中文', () => {
    expect(weekdayLabel('2026-08-15')).toBe('周六')
    expect(weekdayLabel('2026-08-17')).toBe('周一')
    expect(monthDayLabel('2026-08-15')).toBe('8月15日')
  })

  it('recentDates 返回含今天的升序日期', () => {
    expect(recentDates('2026-08-15', 3)).toEqual(['2026-08-13', '2026-08-14', '2026-08-15'])
  })
})

describe('问候与状态文案', () => {
  it('greetingByHour 按时段返回问候语', () => {
    expect(greetingByHour(3)).toBe('夜深了')
    expect(greetingByHour(8)).toBe('早上好')
    expect(greetingByHour(12)).toBe('中午好')
    expect(greetingByHour(15)).toBe('下午好')
    expect(greetingByHour(21)).toBe('晚上好')
  })

  it('statusLabel 根据进度返回状态', () => {
    expect(statusLabel(90)).toBe('状态极佳')
    expect(statusLabel(60)).toBe('保持专注')
    expect(statusLabel(30)).toBe('继续加油')
    expect(statusLabel(5)).toBe('开始行动')
    expect(statusLabel(0, false)).toBe('等待计划')
  })
})

describe('进度计算', () => {
  it('computeProgress 合并任务与习惯计算百分比', () => {
    expect(computeProgress(3, 6, 2, 5)).toBe(45)
    expect(computeProgress(0, 0, 0, 0)).toBe(0)
    expect(computeProgress(6, 6, 5, 5)).toBe(100)
  })

  it('percent 安全处理除零并限制上限', () => {
    expect(percent(1, 0)).toBe(0)
    expect(percent(1, 3)).toBe(33)
    expect(percent(9, 5)).toBe(100)
  })
})

describe('时间工具', () => {
  it('timeToMinutes 解析 HH:mm', () => {
    expect(timeToMinutes('07:30')).toBe(450)
    expect(timeToMinutes('23:59')).toBe(1439)
    expect(timeToMinutes('')).toBe(0)
    expect(timeToMinutes('abc')).toBe(0)
  })

  it('durationBetween 计算时间段（支持跨零点）', () => {
    expect(durationBetween('09:00', '10:30')).toBe(90)
    expect(durationBetween('23:30', '00:30')).toBe(60)
    expect(durationBetween('', '10:00')).toBe(0)
  })

  it('formatMinutes 输出中文时长', () => {
    expect(formatMinutes(0)).toBe('0 分钟')
    expect(formatMinutes(45)).toBe('45 分钟')
    expect(formatMinutes(60)).toBe('1 小时')
    expect(formatMinutes(80)).toBe('1 小时 20 分钟')
  })
})

describe('下一个任务选取', () => {
  const schedules = [
    { id: 1, time: '07:00', done: true, title: '起床' },
    { id: 2, time: '09:30', done: false, title: '剪辑学习' },
    { id: 3, time: '14:00', done: false, title: '减肥运动' },
    { id: 4, time: '20:00', done: false, title: '工作复盘' }
  ]

  it('返回时间不早于当前时刻的最近未完成任务', () => {
    const now = new Date(2026, 7, 15, 10, 0)
    expect(nextTaskOf(schedules, now)?.id).toBe(3)
  })

  it('全部时间已过时返回最早的未完成任务', () => {
    const now = new Date(2026, 7, 15, 22, 0)
    expect(nextTaskOf(schedules, now)?.id).toBe(2)
  })

  it('全部完成时返回 null', () => {
    const now = new Date(2026, 7, 15, 10, 0)
    expect(nextTaskOf(schedules.map((s) => ({ ...s, done: true })), now)).toBeNull()
  })

  it('空列表返回 null', () => {
    expect(nextTaskOf([], new Date())).toBeNull()
  })
})

describe('习惯连续打卡统计', () => {
  it('从今天连续回溯计算天数', () => {
    expect(habitStreak(['2026-08-15', '2026-08-14', '2026-08-13'], '2026-08-15')).toBe(3)
  })

  it('今天未打卡时连续天数为 0', () => {
    expect(habitStreak(['2026-08-14', '2026-08-13'], '2026-08-15')).toBe(0)
  })

  it('中间断档时只统计最近连续段', () => {
    expect(habitStreak(['2026-08-15', '2026-08-14', '2026-08-12'], '2026-08-15')).toBe(2)
  })
})