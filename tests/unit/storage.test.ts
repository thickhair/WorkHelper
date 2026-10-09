/**
 * 数据存储集成测试：以临时目录作为数据目录，验证迁移、种子数据与各领域服务的
 * 增删改查、统计计算是否正确（electron 模块被 mock，测试在 Node 环境运行）。
 */
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const tempRoot = mkdtempSync(join(tmpdir(), 'workhelper-test-'))

vi.mock('electron', () => ({
  app: {
    getPath: () => tempRoot,
    getVersion: () => '1.0.0'
  }
}))

import { closeDb, getDb } from '../../src/main/db/database'
import { habitService } from '../../src/main/services/habit.service'
import { moduleService } from '../../src/main/services/module.service'
import { newsService } from '../../src/main/services/news.service'
import { reviewService } from '../../src/main/services/review.service'
import { statsService } from '../../src/main/services/stats.service'
import {
  priorityService,
  scheduleService,
  todoService
} from '../../src/main/services/task.service'

const DATE = '2026-08-15'

beforeEach(() => {
  closeDb()
  rmSync(join(tempRoot, 'data'), { recursive: true, force: true })
  getDb()
})

afterAll(() => {
  closeDb()
  rmSync(tempRoot, { recursive: true, force: true })
})

describe('数据库初始化', () => {
  it('创建全部数据表并写入默认习惯与分类模块', () => {
    const db = getDb()
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => String(row.name))
    expect(tables).toContain('schedules')
    expect(tables).toContain('todos')
    expect(tables).toContain('habits')
    expect(tables).toContain('habit_logs')
    expect(tables).toContain('priorities')
    expect(tables).toContain('module_records')
    expect(tables).toContain('module_notes')
    expect(tables).toContain('reviews')
    expect(tables).toContain('focus_logs')

    expect(habitService.list(DATE)).toHaveLength(5)
    expect(moduleService.list()).toHaveLength(9)
  })

  it('重复初始化幂等，不会重复写入种子数据', () => {
    closeDb()
    getDb()
    expect(habitService.list(DATE)).toHaveLength(5)
    expect(moduleService.list()).toHaveLength(9)
  })
})

describe('日程服务', () => {
  it('新增后按时间升序返回，并支持更新、勾选与删除', () => {
    scheduleService.create({ date: DATE, time: '14:00', title: '运动', description: '', done: false })
    scheduleService.create({ date: DATE, time: '07:00', title: '起床', description: '早餐', done: false })

    let list = scheduleService.list(DATE)
    expect(list.map((s) => s.time)).toEqual(['07:00', '14:00'])

    const target = list[0]
    scheduleService.update(target.id, { title: '起床 + 早餐' })
    expect(scheduleService.get(target.id)?.title).toBe('起床 + 早餐')

    scheduleService.toggle(target.id, true)
    expect(scheduleService.get(target.id)?.done).toBe(true)

    scheduleService.remove(target.id)
    list = scheduleService.list(DATE)
    expect(list).toHaveLength(1)
  })

  it('不同日期的数据相互隔离', () => {
    scheduleService.create({ date: DATE, time: '09:00', title: 'A', description: '', done: false })
    scheduleService.create({ date: '2026-08-16', time: '09:00', title: 'B', description: '', done: false })
    expect(scheduleService.list(DATE)).toHaveLength(1)
    expect(scheduleService.list('2026-08-16')).toHaveLength(1)
  })
})

describe('待办与重要事项服务', () => {
  it('待办支持时间段与完成状态', () => {
    const todo = todoService.create({
      date: DATE,
      title: '背单词',
      startTime: '08:00',
      endTime: '09:00',
      done: false
    })
    expect(todo.startTime).toBe('08:00')
    todoService.toggle(todo.id, true)
    expect(todoService.list(DATE)[0].done).toBe(true)
    todoService.remove(todo.id)
    expect(todoService.list(DATE)).toHaveLength(0)
  })

  it('重要事项保存优先级', () => {
    priorityService.create({
      date: DATE,
      title: '发布视频',
      startTime: '16:00',
      endTime: '16:30',
      priority: 'high',
      done: false
    })
    expect(priorityService.list(DATE)[0].priority).toBe('high')
  })
})

describe('习惯打卡服务', () => {
  it('打卡次数按目标范围限制，可撤销', () => {
    const habit = habitService.list(DATE)[0]
    expect(habit.count).toBe(0)

    const afterFirst = habitService.checkIn(habit.id, DATE, 1)
    expect(afterFirst?.count).toBe(1)

    // 撤销到 0 后不会出现负数
    const afterUndo = habitService.checkIn(habit.id, DATE, -1)
    expect(afterUndo?.count).toBe(0)
    expect(habitService.checkIn(habit.id, DATE, -1)?.count).toBe(0)
  })

  it('统计达标习惯数量与总数', () => {
    const habits = habitService.list(DATE)
    habitService.checkIn(habits[0].id, DATE, 1)
    habitService.checkIn(habits[1].id, DATE, 1)
    const completion = habitService.completion(DATE)
    expect(completion.done).toBe(2)
    expect(completion.total).toBe(5)
  })

  it('连续打卡天数从今天回溯统计', () => {
    const habit = habitService.list(DATE)[0]
    habitService.checkIn(habit.id, '2026-08-15', 1)
    habitService.checkIn(habit.id, '2026-08-14', 1)
    habitService.checkIn(habit.id, '2026-08-13', 1)
    const dates = habitService.checkedDates(habit.id)
    expect(statsService.overview(7, DATE).streakDays).toBe(3)
    expect(dates).toContain('2026-08-15')
  })

  it('支持新增、修改与删除习惯', () => {
    const created = habitService.create({ name: '冥想', icon: '🧘', target: 1 })
    expect(habitService.list(DATE).some((h) => h.id === created.id)).toBe(true)

    habitService.update(created.id, { target: 3 })
    expect(habitService.get(created.id)?.target).toBe(3)

    habitService.remove(created.id)
    expect(habitService.get(created.id)).toBeNull()
  })
})

describe('分类模块服务', () => {
  it('记录增删改查与汇总统计', () => {
    const record = moduleService.createRecord({
      moduleKey: 'english',
      date: DATE,
      title: '背单词 50 个',
      duration: 30,
      note: '完成'
    })
    moduleService.createRecord({
      moduleKey: 'english',
      date: '2026-08-16',
      title: '跟读练习',
      duration: 20,
      note: ''
    })

    const summary = moduleService.summary('english')
    expect(summary.records).toBe(2)
    expect(summary.minutes).toBe(50)
    expect(summary.lastDate).toBe('2026-08-16')

    moduleService.updateRecord(record.id, { duration: 45 })
    expect(moduleService.summary('english').minutes).toBe(65)

    moduleService.removeRecord(record.id)
    expect(moduleService.summary('english').records).toBe(1)
  })

  it('笔记保存与更新时间刷新', () => {
    const note = moduleService.createNote({
      moduleKey: 'ai',
      title: '提示词技巧',
      content: '角色 + 任务 + 约束'
    })
    expect(moduleService.notes('ai')).toHaveLength(1)

    moduleService.updateNote(note.id, { content: '结构化提示词模板' })
    expect(moduleService.getNote(note.id)?.content).toBe('结构化提示词模板')
  })

  it('模块目标可更新', () => {
    moduleService.updateGoal('fitness', '每周运动 5 次')
    expect(moduleService.get('fitness')?.goal).toBe('每周运动 5 次')
  })

  it('投入排行按累计时长倒序', () => {
    moduleService.createRecord({ moduleKey: 'reading', date: DATE, title: '读书', duration: 60, note: '' })
    moduleService.createRecord({ moduleKey: 'english', date: DATE, title: '背单词', duration: 20, note: '' })
    const trend = moduleService.trend()
    expect(trend[0].moduleKey).toBe('reading')
    expect(trend[0].minutes).toBe(60)
  })
})

describe('统计服务', () => {
  it('单日统计汇总任务与习惯进度', () => {
    scheduleService.create({ date: DATE, time: '07:00', title: 'A', description: '', done: true })
    scheduleService.create({ date: DATE, time: '08:00', title: 'B', description: '', done: false })
    todoService.create({ date: DATE, title: 'C', startTime: '', endTime: '', done: true })

    const habits = habitService.list(DATE)
    habitService.checkIn(habits[0].id, DATE, 1)
    habitService.checkIn(habits[1].id, DATE, 1)

    const stats = statsService.day(DATE)
    expect(stats.taskDone).toBe(2)
    expect(stats.taskTotal).toBe(3)
    expect(stats.habitDone).toBe(2)
    expect(stats.habitTotal).toBe(5)
    // (2 + 2) / (3 + 5) = 50%
    expect(stats.progress).toBe(50)
    expect(stats.statusLabel).toBe('保持专注')
  })

  it('近 7 天趋势返回 7 个数据点且含今日', () => {
    const trends = statsService.trend(7, DATE)
    expect(trends).toHaveLength(7)
    expect(trends[trends.length - 1].date).toBe(DATE)
    expect(trends[0].date).toBe('2026-08-09')
  })

  it('总览统计累计指标', () => {
    scheduleService.create({ date: DATE, time: '07:00', title: 'A', description: '', done: true })
    const habits = habitService.list(DATE)
    habitService.checkIn(habits[0].id, DATE, 2)
    const overview = statsService.overview(7, DATE)
    expect(overview.totalTaskDone).toBe(1)
    expect(overview.totalHabitChecks).toBe(2)
    expect(overview.trends).toHaveLength(7)
    expect(overview.modules).toHaveLength(9)
  })
})

describe('复盘与资讯服务', () => {
  it('复盘按日期 upsert', () => {
    reviewService.save({ date: DATE, doneText: '完成计划', problemText: '', planText: '', mood: 4 })
    reviewService.save({ date: DATE, doneText: '完成计划 + 复盘', problemText: '拖延', planText: '早起', mood: 5 })

    expect(reviewService.list()).toHaveLength(1)
    const review = reviewService.get(DATE)
    expect(review?.doneText).toBe('完成计划 + 复盘')
    expect(review?.mood).toBe(5)

    reviewService.remove(DATE)
    expect(reviewService.list()).toHaveLength(0)
  })

  it('资讯支持关键字搜索与收藏筛选', () => {
    newsService.create({
      title: 'AI 工具盘点',
      source: '36氪',
      url: 'https://example.com',
      summary: '年度 AI 效率工具',
      tags: 'AI 效率',
      favorite: false
    })
    const second = newsService.create({
      title: '剪辑技巧',
      source: '少数派',
      url: '',
      summary: '',
      tags: '剪辑',
      favorite: false
    })
    newsService.toggleFavorite(second.id)

    expect(newsService.list('AI')).toHaveLength(1)
    expect(newsService.list('', true)).toHaveLength(1)
    expect(newsService.list('', false)).toHaveLength(2)
  })
})