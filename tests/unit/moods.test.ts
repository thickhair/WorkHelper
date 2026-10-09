/**
 * 每日心情单元测试：连续打卡天数统计（moodStreak）。
 */
import { describe, expect, it } from 'vitest'
import { moodStreak } from '@shared/moods'

describe('心情连续打卡统计', () => {
  it('从今天连续回溯统计天数', () => {
    expect(moodStreak(['2026-08-13', '2026-08-14', '2026-08-15'], '2026-08-15')).toBe(3)
  })

  it('今天未记录时连续天数为 0', () => {
    expect(moodStreak(['2026-08-13', '2026-08-14'], '2026-08-15')).toBe(0)
  })

  it('中间断档时只统计最近连续段', () => {
    expect(moodStreak(['2026-08-11', '2026-08-14', '2026-08-15'], '2026-08-15')).toBe(2)
  })

  it('支持跨月回溯', () => {
    expect(moodStreak(['2026-08-30', '2026-08-31', '2026-09-01'], '2026-09-01')).toBe(3)
  })

  it('无任何记录时返回 0', () => {
    expect(moodStreak([], '2026-08-15')).toBe(0)
  })
})