/**
 * 共享逻辑单元测试：日期处理、进度计算、状态推导、日程排序等。
 */
import { describe, expect, it } from 'vitest'
import type { Schedule } from '@shared/types'
import {
  addDays,
  averageCompletionMinutes,
  computeProgress,
  durationBetween,
  formatDate,
  formatMinutes,
  greetingByHour,
  habitStreak,
  isSameDay,
  monthDayLabel,
  moveSchedule,
  parseDate,
  percent,
  recentDates,
  sortDaySchedules,
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

describe('当日日程清单排序', () => {
  const schedules: Schedule[] = [
    {
      id: 1,
      date: '2026-08-15',
      time: '09:00',
      title: '产品评审会',
      description: '确认交互稿',
      color: '',
      pinned: false,
      done: false,
      completedAt: '',
      sortOrder: 0,
      createdAt: ''
    },
    {
      id: 2,
      date: '2026-08-15',
      time: '07:00',
      title: '早餐',
      description: '',
      color: '',
      pinned: false,
      done: true,
      completedAt: '2026-08-15 07:30:00',
      sortOrder: 1,
      createdAt: '2026-08-15 07:00:00'
    },
    {
      id: 3,
      date: '2026-08-15',
      time: '',
      title: '整理灵感笔记',
      description: '',
      color: '#5daf74',
      pinned: false,
      done: false,
      completedAt: '',
      sortOrder: 0,
      createdAt: ''
    },
    {
      id: 4,
      date: '2026-08-15',
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

  it('未完成在前、按时间升序（无时间排最后），已完成沉底', () => {
    const list = sortDaySchedules(schedules)
    expect(list.map((item) => item.title)).toEqual([
      '产品评审会',
      '整理灵感笔记',
      '夜间跑步',
      '早餐'
    ])
  })

  it('置顶日程排在所有未完成项最前（优先于时间）', () => {
    const pinnedSchedules: Schedule[] = [
      ...schedules,
      {
        id: 5,
        date: '2026-08-15',
        time: '20:00',
        title: '置顶复盘',
        description: '',
        color: '#e86a5e',
        pinned: true,
        done: false,
        completedAt: '',
        sortOrder: 2,
        createdAt: ''
      }
    ]
    const list = sortDaySchedules(pinnedSchedules)
    expect(list[0].title).toBe('置顶复盘')
    expect(list[0].pinned).toBe(true)
    expect(list[0].color).toBe('#e86a5e')
  })

  it('不修改原数组，空列表返回空数组', () => {
    const input = [...schedules]
    const list = sortDaySchedules(input)
    expect(list).not.toBe(input)
    expect(sortDaySchedules([])).toEqual([])
  })
})

describe('日程拖拽落位计算', () => {
  const schedules: Schedule[] = [
    {
      id: 1,
      date: '2026-08-15',
      time: '09:00',
      title: '产品评审会',
      description: '',
      color: '',
      pinned: false,
      done: false,
      completedAt: '',
      sortOrder: 0,
      createdAt: ''
    },
    {
      id: 2,
      date: '2026-08-15',
      time: '07:00',
      title: '早餐',
      description: '',
      color: '',
      pinned: false,
      done: true,
      completedAt: '',
      sortOrder: 1,
      createdAt: ''
    },
    {
      id: 3,
      date: '2026-08-15',
      time: '',
      title: '整理灵感笔记',
      description: '',
      color: '',
      pinned: false,
      done: false,
      completedAt: '',
      sortOrder: 0,
      createdAt: ''
    },
    {
      id: 4,
      date: '2026-08-15',
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

  it('把条目移动到目标项之前 / 之后', () => {
    const list = sortDaySchedules(schedules)
    // 列表顺序：产品评审会 → 整理灵感笔记 → 夜间跑步 → 早餐
    const before = moveSchedule(list, 4, 3, false)
    expect(before.map((item) => item.id)).toEqual([1, 4, 3, 2])

    const after = moveSchedule(list, 3, 4, true)
    expect(after.map((item) => item.id)).toEqual([1, 4, 3, 2])
  })

  it('原地拖动或无效 id 时返回原顺序副本', () => {
    const list = sortDaySchedules(schedules)
    expect(moveSchedule(list, 3, 3, false).map((item) => item.id)).toEqual(
      list.map((item) => item.id)
    )
    expect(moveSchedule(list, 99, 3, false).map((item) => item.id)).toEqual(
      list.map((item) => item.id)
    )
    expect(moveSchedule(list, 3, 99, false).map((item) => item.id)).toEqual(
      list.map((item) => item.id)
    )
  })
})

describe('平均完成耗时', () => {
  it('计算创建→完成的平均分钟数（四舍五入）', () => {
    const avg = averageCompletionMinutes([
      { createdAt: '2026-08-15 08:00:00', completedAt: '2026-08-15 09:00:00' },
      { createdAt: '2026-08-15 08:00:00', completedAt: '2026-08-15 09:32:30' }
    ])
    // (60 + 92.5) / 2 = 76.25 → 76
    expect(avg).toBe(76)
  })

  it('跳过缺少完成时刻、无法解析或时间倒挂的样本', () => {
    const avg = averageCompletionMinutes([
      { createdAt: '2026-08-15 08:00:00', completedAt: '' },
      { createdAt: '2026-08-15 09:00:00', completedAt: '2026-08-15 08:00:00' },
      { createdAt: 'bad', completedAt: '2026-08-15 10:00:00' },
      { createdAt: '2026-08-15 08:00:00', completedAt: '2026-08-15 08:30:00' }
    ])
    expect(avg).toBe(30)
  })

  it('无有效样本返回 null', () => {
    expect(averageCompletionMinutes([])).toBeNull()
    expect(averageCompletionMinutes([{ createdAt: '', completedAt: '' }])).toBeNull()
  })
})