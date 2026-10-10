/**
 * 数据统计服务：单日概览与近 N 天趋势（供首页与每日计划页使用）。
 */
import { getDb } from '../db/database'
import type { DayStats, TrendPoint } from '@shared/types'
import { computeProgress, formatDate, recentDates, statusLabel } from '@shared/logic'

interface CountRow {
  done: number
  total: number
}

/** 统计指定日期日程的完成情况 */
function taskCount(date: string): CountRow {
  const db = getDb()
  const row = db
    .prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END), 0) AS done
       FROM schedules WHERE date = ?`
    )
    .get(date) as { done: number; total: number }
  return { done: Number(row.done ?? 0), total: Number(row.total ?? 0) }
}

/** 统计指定日期习惯的「打卡次数总和 / 目标总和」 */
function habitCount(date: string): CountRow {
  const db = getDb()
  const row = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN h.target > 0 THEN h.target ELSE 1 END), 0) AS total,
         COALESCE(SUM(MIN(COALESCE(l.count, 0), CASE WHEN h.target > 0 THEN h.target ELSE 1 END)), 0) AS done
       FROM habits h
       LEFT JOIN habit_logs l ON l.habit_id = h.id AND l.date = ?
       WHERE h.archived = 0`
    )
    .get(date) as { done: number; total: number }
  return { done: Number(row.done ?? 0), total: Number(row.total ?? 0) }
}

/** 指定日期习惯「已达标数量 / 习惯总数」（与首页展示口径一致） */
function habitCompletionCount(date: string): CountRow {
  const db = getDb()
  const row = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(CASE WHEN COALESCE(l.count, 0) >= CASE WHEN h.target > 0 THEN h.target ELSE 1 END THEN 1 ELSE 0 END), 0) AS done
       FROM habits h
       LEFT JOIN habit_logs l ON l.habit_id = h.id AND l.date = ?
       WHERE h.archived = 0`
    )
    .get(date) as { done: number; total: number }
  return { done: Number(row.done ?? 0), total: Number(row.total ?? 0) }
}

function focusMinutes(date: string): number {
  const row = getDb()
    .prepare('SELECT COALESCE(SUM(minutes), 0) AS m FROM focus_logs WHERE date = ?')
    .get(date) as { m: number }
  return Number(row.m ?? 0)
}

export const statsService = {
  /** 单日统计（每日计划页顶部四张卡片） */
  day(date: string): DayStats {
    const tasks = taskCount(date)
    const habits = habitCompletionCount(date)
    const progress = computeProgress(tasks.done, tasks.total, habits.done, habits.total)
    return {
      date,
      taskDone: tasks.done,
      taskTotal: tasks.total,
      habitDone: habits.done,
      habitTotal: habits.total,
      progress,
      statusLabel: statusLabel(progress, tasks.total + habits.total > 0)
    }
  },

  /** 近 n 天趋势（默认 7 天，含今天） */
  trend(days = 7, today = formatDate(new Date())): TrendPoint[] {
    return recentDates(today, days).map((date) => {
      const tasks = taskCount(date)
      const habits = habitCount(date)
      return {
        date,
        taskDone: tasks.done,
        taskTotal: tasks.total,
        habitCount: habits.done,
        habitTarget: habits.total,
        focusMinutes: focusMinutes(date)
      }
    })
  }
}