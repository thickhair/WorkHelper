/**
 * 数据存储集成测试：以临时目录作为数据目录，验证迁移、种子数据与各领域服务的
 * 增删改查、统计计算是否正确（electron 模块被 mock，测试在 Node 环境运行）。
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

const tempRoot = mkdtempSync(join(tmpdir(), 'workbench-test-'))

vi.mock('electron', () => ({
  app: {
    getPath: () => tempRoot,
    getVersion: () => '1.0.0'
  },
  dialog: {
    showOpenDialog: vi.fn()
  }
}))

import { dialog } from 'electron'
import { closeDb, getDb, getDbPath, setDataDirOverride } from '../../src/main/db/database'
import { anniversaryService } from '../../src/main/services/anniversary.service'
import { assetService } from '../../src/main/services/asset.service'
import { habitService } from '../../src/main/services/habit.service'
import { moodService } from '../../src/main/services/mood.service'
import { savingsService } from '../../src/main/services/savings.service'
import { statsService } from '../../src/main/services/stats.service'
import { storageService } from '../../src/main/services/storage.service'
import {
  priorityService,
  scheduleService,
  todoService
} from '../../src/main/services/task.service'

const DATE = '2026-08-15'

beforeEach(() => {
  closeDb()
  setDataDirOverride(null)
  rmSync(join(tempRoot, 'data'), { recursive: true, force: true })
  rmSync(join(tempRoot, 'storage.json'), { force: true })
  getDb()
})

afterAll(() => {
  closeDb()
  rmSync(tempRoot, { recursive: true, force: true })
})

describe('数据库初始化', () => {
  it('创建全部数据表并写入默认习惯（V4 起不再包含模块/资讯/复盘表）', () => {
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
    expect(tables).toContain('focus_logs')
    expect(tables).toContain('birthdays')
    expect(tables).toContain('moods')
    expect(tables).toContain('anniversaries')
    expect(tables).toContain('asset_accounts')
    expect(tables).toContain('asset_records')
    expect(tables).toContain('saving_goals')
    expect(tables).toContain('saving_deposits')
    // V4 迁移：13 项功能相关表已删除
    expect(tables).not.toContain('modules')
    expect(tables).not.toContain('module_records')
    expect(tables).not.toContain('module_notes')
    expect(tables).not.toContain('news')
    expect(tables).not.toContain('reviews')

    expect(habitService.list(DATE)).toHaveLength(5)
    const version = db.prepare('PRAGMA user_version').get() as { user_version: number }
    expect(version.user_version).toBe(4)
  })

  it('重复初始化幂等，不会重复写入种子数据', () => {
    closeDb()
    getDb()
    expect(habitService.list(DATE)).toHaveLength(5)
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

  it('连续打卡日期集合含全部打卡日', () => {
    const habit = habitService.list(DATE)[0]
    habitService.checkIn(habit.id, '2026-08-15', 1)
    habitService.checkIn(habit.id, '2026-08-14', 1)
    habitService.checkIn(habit.id, '2026-08-13', 1)
    const dates = habitService.checkedDates(habit.id)
    expect(dates).toContain('2026-08-15')
    expect(dates).toContain('2026-08-13')
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
})

describe('心情服务', () => {
  it('写入后可按区间查询，重复写入同一天会覆盖', () => {
    moodService.set('2026-08-14', 4)
    moodService.set(DATE, 5)
    moodService.set(DATE, 2)

    const list = moodService.range('2026-08-01', '2026-08-31')
    expect(list.map((item) => item.date)).toEqual(['2026-08-14', '2026-08-15'])
    expect(list[1].mood).toBe(2)
    expect(moodService.get(DATE)?.mood).toBe(2)
  })

  it('等级越界自动收敛到 1-5，传入 null 清除记录', () => {
    expect(moodService.set(DATE, 9)?.mood).toBe(5)
    expect(moodService.set(DATE, 0)?.mood).toBe(1)
    expect(moodService.set(DATE, null)).toBeNull()
    expect(moodService.get(DATE)).toBeNull()
  })
})

describe('倒数日与纪念日服务', () => {
  it('新增、编辑、列表与删除', () => {
    const created = anniversaryService.save({
      name: '结婚纪念日',
      kind: 'anniversary',
      year: 2020,
      month: 10,
      day: 1,
      note: ''
    })
    expect(created.kind).toBe('anniversary')
    expect(anniversaryService.list()).toHaveLength(1)

    anniversaryService.save({
      id: created.id,
      name: '结婚纪念日（更新）',
      kind: 'anniversary',
      year: 2020,
      month: 10,
      day: 2,
      note: '改期'
    })
    const updated = anniversaryService.list()[0]
    expect(updated.name).toBe('结婚纪念日（更新）')
    expect(updated.day).toBe(2)

    anniversaryService.remove(created.id)
    expect(anniversaryService.list()).toHaveLength(0)
  })

  it('倒数日必须含年份，非法输入抛出错误', () => {
    expect(() =>
      anniversaryService.save({ name: '考试', kind: 'countdown', year: null, month: 6, day: 7, note: '' })
    ).toThrow('完整日期')
    expect(() =>
      anniversaryService.save({ name: '', kind: 'anniversary', year: null, month: 1, day: 1, note: '' })
    ).toThrow('名称')
    expect(() =>
      anniversaryService.save({ name: 'X', kind: 'anniversary', year: null, month: 2, day: 31, note: '' })
    ).toThrow('日期')
  })
})

describe('资产服务', () => {
  function createAccount(balance = 0): number {
    return assetService.saveAccount({ platform: 'alipay', name: '支付宝', balance, note: '' }).id
  }

  it('账户增删改查与平台回退', () => {
    const account = assetService.saveAccount({
      platform: 'unknown-platform',
      name: '测试账户',
      balance: 100.5,
      note: ''
    })
    expect(account.platform).toBe('other')
    expect(assetService.accounts()).toHaveLength(1)

    assetService.saveAccount({ id: account.id, platform: 'cmb', name: '招行卡', balance: 200, note: '工资卡' })
    const updated = assetService.accounts()[0]
    expect(updated.name).toBe('招行卡')
    expect(updated.balance).toBe(200)
    expect(updated.platform).toBe('cmb')

    assetService.removeAccount(account.id)
    expect(assetService.accounts()).toHaveLength(0)
  })

  it('收支记录联动账户余额，编辑与删除自动冲正', () => {
    const accountId = createAccount(100)
    const income = assetService.saveRecord({
      accountId,
      kind: 'income',
      category: '工资',
      amount: 500,
      date: DATE,
      note: ''
    })
    expect(assetService.accounts()[0].balance).toBe(600)

    const expense = assetService.saveRecord({
      accountId,
      kind: 'expense',
      category: '餐饮',
      amount: 35.5,
      date: DATE,
      note: '午餐'
    })
    expect(assetService.accounts()[0].balance).toBe(564.5)

    // 编辑金额：先冲正旧值再入新值
    assetService.saveRecord({ ...expense, amount: 50 })
    expect(assetService.accounts()[0].balance).toBe(550)

    // 删除收入记录：余额扣回
    assetService.removeRecord(income.id)
    expect(assetService.accounts()[0].balance).toBe(50)

    const list = assetService.records({ month: '2026-08' })
    expect(list).toHaveLength(1)
    expect(list[0].accountName).toBe('支付宝')
  })

  it('删除账户时级联删除其收支记录', () => {
    const accountId = createAccount(100)
    assetService.saveRecord({ accountId, kind: 'expense', category: '购物', amount: 40, date: DATE, note: '' })
    assetService.removeAccount(accountId)
    expect(assetService.records({})).toHaveLength(0)
  })

  it('金额必须为正数，非法账户报错', () => {
    const accountId = createAccount(0)
    expect(() =>
      assetService.saveRecord({ accountId, kind: 'expense', category: '餐饮', amount: 0, date: DATE, note: '' })
    ).toThrow('大于 0')
    expect(() =>
      assetService.saveRecord({ accountId: 999, kind: 'expense', category: '餐饮', amount: 10, date: DATE, note: '' })
    ).toThrow('账户')
  })

  it('首页概览汇总总资产与本月收支', () => {
    const accountId = createAccount(1000)
    assetService.saveRecord({ accountId, kind: 'income', category: '工资', amount: 8000, date: DATE, note: '' })
    assetService.saveRecord({ accountId, kind: 'expense', category: '餐饮', amount: 200, date: DATE, note: '' })
    assetService.saveRecord({ accountId, kind: 'expense', category: '购物', amount: 300, date: '2026-07-10', note: '' })

    const summary = assetService.summary(DATE)
    // 余额随记录联动：1000 + 8000 - 200 - 300 = 8500
    expect(summary.total).toBe(8500)
    expect(summary.accountCount).toBe(1)
    expect(summary.monthIncome).toBe(8000)
    expect(summary.monthExpense).toBe(200)
  })

  it('趋势由当前余额回推，分类统计按金额降序', () => {
    const accountId = createAccount(0)
    assetService.saveRecord({ accountId, kind: 'income', category: '工资', amount: 1000, date: '2026-08-14', note: '' })
    assetService.saveRecord({ accountId, kind: 'expense', category: '餐饮', amount: 100, date: DATE, note: '' })
    assetService.saveRecord({ accountId, kind: 'expense', category: '餐饮', amount: 50, date: DATE, note: '' })
    assetService.saveRecord({ accountId, kind: 'expense', category: '交通', amount: 20, date: DATE, note: '' })

    const trend = assetService.trend(3, DATE)
    expect(trend).toHaveLength(3)
    // 当前余额 830 = 1000 - 170
    expect(trend[2].total).toBe(830)
    expect(trend[2].date).toBe(DATE)
    expect(trend[1].total).toBe(1000)

    const stats = assetService.categoryStats('expense', '2026-08')
    expect(stats[0].category).toBe('餐饮')
    expect(stats[0].amount).toBe(150)
    expect(stats[0].count).toBe(2)
    expect(stats[1].category).toBe('交通')
  })
})

describe('攒钱与想买服务', () => {
  it('创建目标、存入更新进度，达标自动完成', () => {
    const goal = savingsService.save({
      kind: 'plan',
      name: '旅行基金',
      target: 1000,
      period: 'monthly',
      perAmount: 400,
      startDate: DATE,
      note: ''
    })
    expect(goal.saved).toBe(0)
    expect(goal.percent).toBe(0)

    const afterFirst = savingsService.deposit(goal.id, 400)
    expect(afterFirst.saved).toBe(400)
    expect(afterFirst.percent).toBe(40)
    expect(afterFirst.done).toBe(false)

    const afterDone = savingsService.deposit(goal.id, 600)
    expect(afterDone.saved).toBe(1000)
    expect(afterDone.percent).toBe(100)
    expect(afterDone.done).toBe(true)

    const deposits = savingsService.deposits(goal.id)
    expect(deposits).toHaveLength(2)
    expect(deposits[0].amount).toBe(600)
  })

  it('「想买」与攒钱计划分表查询互不干扰', () => {
    savingsService.save({ kind: 'plan', name: '应急金', target: 5000, period: 'monthly', perAmount: 500, startDate: DATE, note: '' })
    savingsService.save({ kind: 'wish', name: '新相机', target: 8000, period: 'weekly', perAmount: 200, startDate: DATE, note: '' })
    expect(savingsService.list('plan')).toHaveLength(1)
    expect(savingsService.list('wish')).toHaveLength(1)
    expect(savingsService.list('wish')[0].name).toBe('新相机')
  })

  it('非法输入抛出错误，删除目标级联删除明细', () => {
    expect(() =>
      savingsService.save({ kind: 'plan', name: 'X', target: 0, period: 'monthly', perAmount: 100, startDate: DATE, note: '' })
    ).toThrow('目标金额')
    expect(() =>
      savingsService.save({ kind: 'plan', name: 'X', target: 100, period: 'daily', perAmount: 0, startDate: DATE, note: '' })
    ).toThrow('计划存入')

    const goal = savingsService.save({
      kind: 'plan',
      name: '删除我',
      target: 100,
      period: 'none',
      perAmount: 0,
      startDate: DATE,
      note: ''
    })
    savingsService.deposit(goal.id, 50)
    savingsService.remove(goal.id)
    expect(savingsService.list('plan')).toHaveLength(0)
    expect(savingsService.deposits(goal.id)).toHaveLength(0)
  })
})

describe('数据存储位置服务', () => {
  it('默认使用 userData 下的 data 目录', () => {
    const info = storageService.info()
    expect(info.custom).toBe(false)
    expect(info.portable).toBe(false)
    expect(info.dataPath).toBe(join(tempRoot, 'data', 'workbench.db'))
  })

  it('更改存储位置后把数据复制到新目录并立即切换', async () => {
    const target = mkdtempSync(join(tmpdir(), 'workbench-store-'))
    ;(dialog.showOpenDialog as Mock).mockResolvedValue({
      canceled: false,
      filePaths: [target]
    })
    moodService.set(DATE, 5)

    const newPath = await storageService.change(null)

    expect(newPath).toBe(join(target, 'Workbench', 'workbench.db'))
    expect(existsSync(newPath as string)).toBe(true)
    // 新位置数据库可正常读写，且包含迁移前的数据
    expect(moodService.get(DATE)?.mood).toBe(5)
    // 配置已写入 storage.json，信息接口同步更新
    expect(storageService.info().custom).toBe(true)
    expect(storageService.info().dataDir).toBe(join(target, 'Workbench'))

    // 数据库已切换到新目录且仍处于打开状态，Windows 下需先关闭再清理临时目录
    closeDb()
    rmSync(target, { recursive: true, force: true })
  })

  it('目标目录已存在数据文件时拒绝切换', async () => {
    const target = mkdtempSync(join(tmpdir(), 'workbench-store-'))
    ;(dialog.showOpenDialog as Mock).mockResolvedValue({
      canceled: false,
      filePaths: [target]
    })
    const existingDir = join(target, 'Workbench')
    mkdirSync(existingDir, { recursive: true })
    writeFileSync(join(existingDir, 'workbench.db'), 'existing-data')

    await expect(storageService.change(null)).rejects.toThrow('已存在 Workbench 数据')

    // 校验失败时保持原位置不变
    expect(storageService.info().custom).toBe(false)
    expect(storageService.info().dataPath).toBe(join(tempRoot, 'data', 'workbench.db'))

    rmSync(target, { recursive: true, force: true })
  })
})
