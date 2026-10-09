/**
 * 数据统计服务：单日概览、近 N 天趋势、累计指标与连续打卡统计。
 */
import { getDb } from '../db/database'
import type { DayStats, StatsOverview, TrendPoint } from '@shared/types'
import { computeProgress, formatDate, habitStreak, recentDates, statusLabel } from '@shared/logic'
import { moduleService } from './module.service'

interface CountRow {
  done: number
  total: number
}

/** 统计指定日期「日程 + 待办 + 重要事项」的完成情况 */
function taskCount(date: string): CountRow {
  const db = getDb()
  const row = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM schedules  WHERE date = ?) +
         (SELECT COUNT(*) FROM todos      WHERE date = ?) +
         (SELECT COUNT(*) FROM priorities WHERE date = ?) AS total,
         (SELECT COUNT(*) FROM schedules  WHERE date = ? AND done = 1) +
         (SELECT COUNT(*) FROM todos      WHERE date = ? AND done = 1) +
         (SELECT COUNT(*) FROM priorities WHERE date = ? AND done = 1) AS done`
    )
    .get(date, date, date, date, date, date) as { done: number; total: number }
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
  },

  /** 数据统计页聚合数据 */
  overview(days = 7, today = formatDate(new Date())): StatsOverview {
    const db = getDb()
    const taskRow = db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM schedules  WHERE done = 1) +
           (SELECT COUNT(*) FROM todos      WHERE done = 1) +
           (SELECT COUNT(*) FROM priorities WHERE done = 1) AS c`
      )
      .get() as { c: number }
    const habitRow = db
      .prepare('SELECT COALESCE(SUM(count), 0) AS c FROM habit_logs')
      .get() as { c: number }
    const focusRow = db
      .prepare('SELECT COALESCE(SUM(minutes), 0) AS c FROM focus_logs')
      .get() as { c: number }
    const dateRows = db
      .prepare('SELECT DISTINCT date FROM habit_logs WHERE count > 0 ORDER BY date DESC')
      .all()

    return {
      totalTaskDone: Number(taskRow.c ?? 0),
      totalHabitChecks: Number(habitRow.c ?? 0),
      streakDays: habitStreak(
        dateRows.map((row) => String(row.date)),
        today
      ),
      totalFocusMinutes: Number(focusRow.c ?? 0),
      trends: this.trend(days, today),
      modules: moduleService.trend()
    }
  }
}