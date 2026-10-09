/**
 * 每日心情共享模块：心情等级定义、连续打卡统计（首页一键打卡与日历展示共用）。
 */
import { addDays } from './logic'

/** 心情等级 */
export interface MoodLevel {
  /** 等级值 1-5 */
  value: number
  /** 表情图标 */
  emoji: string
  /** 中文名称 */
  label: string
  /** 展示色调（与全局 tag / 主题变量对应） */
  tone: 'red' | 'blue' | 'plain' | 'green' | 'yellow'
}

/** 心情等级定义（由低到高） */
export const MOOD_LEVELS: MoodLevel[] = [
  { value: 1, emoji: '😣', label: '糟糕', tone: 'red' },
  { value: 2, emoji: '😔', label: '低落', tone: 'blue' },
  { value: 3, emoji: '😐', label: '一般', tone: 'plain' },
  { value: 4, emoji: '🙂', label: '不错', tone: 'green' },
  { value: 5, emoji: '😄', label: '开心', tone: 'yellow' }
]

/** 按等级值查找心情定义 */
export function moodLevel(value: number | null | undefined): MoodLevel | undefined {
  if (value === null || value === undefined) return undefined
  return MOOD_LEVELS.find((level) => level.value === value)
}

/** 等级值 → 表情（未知值返回空字符串） */
export function moodEmoji(value: number | null | undefined): string {
  return moodLevel(value)?.emoji ?? ''
}

/** 等级值 → 中文名称（未记录返回「未记录」） */
export function moodLabel(value: number | null | undefined): string {
  return moodLevel(value)?.label ?? '未记录'
}

/**
 * 计算心情连续打卡天数（从 today 往前回溯，dates 为已记录心情的日期集合）。
 * 今天未记录时返回 0，即连续天数从今天算起。
 */
export function moodStreak(dates: string[], today: string): number {
  const set = new Set(dates)
  let streak = 0
  let cursor = today
  while (set.has(cursor)) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}