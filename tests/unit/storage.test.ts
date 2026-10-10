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
import { closeDb, clampHabitLogs, getDb, getDbPath, setDataDirOverride } from '../../src/main/db/database'
import { anniversaryService } from '../../src/main/services/anniversary.service'
import { assetService } from '../../src/main/services/asset.service'
import { bookService, bookmarkService } from '../../src/main/services/book.service'
import { habitService } from '../../src/main/services/habit.service'
import { moodService } from '../../src/main/services/mood.service'
import { savingsService } from '../../src/main/services/savings.service'
import { settingsService } from '../../src/main/services/settings.service'
import { statsService } from '../../src/main/services/stats.service'
import { storageService } from '../../src/main/services/storage.service'
import { scheduleService } from '../../src/main/services/task.service'

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
    // V7 迁移：新增阅读模块 books / bookmarks 表
    expect(tables).toContain('books')
    expect(tables).toContain('bookmarks')
    // V4 迁移：13 项功能相关表已删除
    expect(tables).not.toContain('modules')
    expect(tables).not.toContain('module_records')
    expect(tables).not.toContain('module_notes')
    expect(tables).not.toContain('news')
    expect(tables).not.toContain('reviews')

    expect(habitService.list(DATE)).toHaveLength(5)
    const version = db.prepare('PRAGMA user_version').get() as { user_version: number }
    expect(version.user_version).toBe(7)

    // V5 迁移：三类任务表新增 completed_at 完成时刻字段
    const columnsOf = (table: string): string[] =>
      db
        .prepare(`PRAGMA table_info(${table})`)
        .all()
        .map((row) => String(row.name))
    expect(columnsOf('schedules')).toContain('completed_at')
    expect(columnsOf('todos')).toContain('completed_at')
    expect(columnsOf('priorities')).toContain('completed_at')

    // V6 迁移：日程表新增 color / pinned 列
    expect(columnsOf('schedules')).toContain('color')
    expect(columnsOf('schedules')).toContain('pinned')
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
    // V5：勾选完成时写入 completed_at，取消完成时清空
    expect(scheduleService.get(target.id)?.completedAt).not.toBe('')
    scheduleService.toggle(target.id, false)
    expect(scheduleService.get(target.id)?.completedAt).toBe('')
    scheduleService.toggle(target.id, true)

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

  it('支持颜色标记与置顶：置顶最前、未设置时间排最后', () => {
    const colored = scheduleService.create({
      date: DATE,
      time: '10:00',
      title: '彩色日程',
      description: '',
      color: '#e86a5e',
      done: false
    })
    const untimed = scheduleService.create({
      date: DATE,
      time: '',
      title: '全天日程',
      description: '',
      done: false
    })
    const pinned = scheduleService.create({
      date: DATE,
      time: '08:00',
      title: '置顶日程',
      description: '',
      pinned: true,
      done: false
    })

    // 顺序：置顶最前 → 有时间按时间升序 → 未设置时间最后
    expect(scheduleService.list(DATE).map((item) => item.title)).toEqual([
      '置顶日程',
      '彩色日程',
      '全天日程'
    ])
    expect(scheduleService.get(colored.id)?.color).toBe('#e86a5e')
    expect(scheduleService.get(colored.id)?.pinned).toBe(false)
    expect(scheduleService.get(pinned.id)?.pinned).toBe(true)

    // 更新：取消颜色、为全天日程置顶（未完成组内按时间排序，全天在最后）
    const updated = scheduleService.update(untimed.id, { pinned: true })
    expect(updated?.pinned).toBe(true)
    expect(scheduleService.list(DATE).map((item) => item.title)).toEqual([
      '置顶日程',
      '全天日程',
      '彩色日程'
    ])
  })

  it('日程手动排序：按给定顺序重编号 sort_order 并持久化', () => {
    const first = scheduleService.create({
      date: DATE,
      time: '',
      title: '日程 A',
      description: '',
      done: false
    })
    const second = scheduleService.create({
      date: DATE,
      time: '',
      title: '日程 B',
      description: '',
      done: false
    })

    scheduleService.reorder([second.id, first.id])
    expect(scheduleService.get(second.id)?.sortOrder).toBe(0)
    expect(scheduleService.get(first.id)?.sortOrder).toBe(1)
    // 列表展示顺序同步（未设置时间的条目按 sortOrder 排列）
    expect(scheduleService.list(DATE).map((item) => item.title)).toEqual(['日程 B', '日程 A'])
  })
})

describe('习惯打卡服务', () => {
  it('打卡次数不超过每日目标，可撤销', () => {
    const single = habitService.list(DATE).find((h) => h.target === 1)!
    const double = habitService.list(DATE).find((h) => h.target === 2)!

    expect(habitService.checkIn(single.id, DATE, 1)?.count).toBe(1)
    // 达到每日目标后继续打卡不再增长（修复旧版本 target*3 上限导致的 3/1 超目标问题）
    expect(habitService.checkIn(single.id, DATE, 1)?.count).toBe(1)

    expect(habitService.checkIn(double.id, DATE, 1)?.count).toBe(1)
    expect(habitService.checkIn(double.id, DATE, 1)?.count).toBe(2)
    expect(habitService.checkIn(double.id, DATE, 1)?.count).toBe(2)

    // 撤销到 0 后不会出现负数
    expect(habitService.checkIn(single.id, DATE, -1)?.count).toBe(0)
    expect(habitService.checkIn(single.id, DATE, -1)?.count).toBe(0)
  })

  it('下调目标次数会收敛该习惯的历史打卡记录', () => {
    const created = habitService.create({ name: '喝水', icon: '💧', target: 3 })
    habitService.checkIn(created.id, DATE, 1)
    habitService.checkIn(created.id, DATE, 1)
    habitService.checkIn(created.id, DATE, 1)
    expect(habitService.list(DATE).find((h) => h.id === created.id)?.count).toBe(3)

    habitService.update(created.id, { target: 1 })
    expect(habitService.list(DATE).find((h) => h.id === created.id)?.count).toBe(1)

    habitService.remove(created.id)
  })

  it('clampHabitLogs 收敛历史超目标脏数据', () => {
    const habit = habitService.list(DATE).find((h) => h.target === 1)!
    getDb()
      .prepare('INSERT OR REPLACE INTO habit_logs (habit_id, date, count) VALUES (?, ?, ?)')
      .run(habit.id, DATE, 3)
    clampHabitLogs(getDb())
    expect(habitService.list(DATE).find((h) => h.id === habit.id)?.count).toBe(1)
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
  it('单日统计汇总日程与习惯进度', () => {
    scheduleService.create({ date: DATE, time: '07:00', title: 'A', description: '', done: true })
    scheduleService.create({ date: DATE, time: '08:00', title: 'B', description: '', done: false })

    const habits = habitService.list(DATE)
    habitService.checkIn(habits[0].id, DATE, 1)
    habitService.checkIn(habits[1].id, DATE, 1)

    const stats = statsService.day(DATE)
    expect(stats.taskDone).toBe(1)
    expect(stats.taskTotal).toBe(2)
    expect(stats.habitDone).toBe(2)
    expect(stats.habitTotal).toBe(5)
    // (1 + 2) / (2 + 5) = 42.86 → 43%
    expect(stats.progress).toBe(43)
    expect(stats.statusLabel).toBe('继续加油')
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

describe('阅读模块（书库 / 书签 / 阅读设置）', () => {
  const sourceTxt = join(tempRoot, 'sample-book.txt')

  beforeEach(() => {
    writeFileSync(sourceTxt, '第一段\n第二段', 'utf8')
  })

  it('导入书籍：复制文件到数据目录并写入记录，默认以文件名命名', () => {
    const book = bookService.importFile(sourceTxt)
    expect(book.format).toBe('txt')
    expect(book.title).toBe('sample-book')
    expect(book.progress).toBe(0)
    expect(book.lastReadAt).toBe('')
    expect(book.cover).toBe('')
    expect(existsSync(join(tempRoot, 'data', 'books', book.fileName))).toBe(true)
    expect(bookService.list()).toHaveLength(1)
  })

  it('导入对话框：取消返回空数组，全部文件不支持时抛出友好错误', async () => {
    ;(dialog.showOpenDialog as Mock).mockResolvedValueOnce({ canceled: true, filePaths: [] })
    expect(await bookService.import(null)).toEqual([])

    ;(dialog.showOpenDialog as Mock).mockResolvedValueOnce({
      canceled: false,
      filePaths: [sourceTxt]
    })
    const imported = await bookService.import(null)
    expect(imported).toHaveLength(1)
    expect(imported[0].title).toBe('sample-book')

    const bad = join(tempRoot, 'bad.bin')
    writeFileSync(bad, 'x')
    ;(dialog.showOpenDialog as Mock).mockResolvedValueOnce({ canceled: false, filePaths: [bad] })
    await expect(bookService.import(null)).rejects.toThrow('所选文件均无法导入')
  })

  it('不支持的扩展名与空文件导入抛出错误', () => {
    const bad = join(tempRoot, 'bad.bin')
    writeFileSync(bad, 'x')
    expect(() => bookService.importFile(bad)).toThrow('不支持的书籍格式')

    const empty = join(tempRoot, 'empty.txt')
    writeFileSync(empty, '')
    expect(() => bookService.importFile(empty)).toThrow('文件内容为空')
  })

  it('文本解码：优先 UTF-8，非 UTF-8 回退 GBK', () => {
    const utf8 = bookService.importFile(sourceTxt)
    expect(bookService.text(utf8.id)).toBe('第一段\n第二段')

    const gbkPath = join(tempRoot, 'gbk-book.txt')
    // 「你好」的 GBK 字节序列，非法 UTF-8：应回退 GBK 解码
    writeFileSync(gbkPath, Buffer.from([0xc4, 0xe3, 0xba, 0xc3]))
    const gbk = bookService.importFile(gbkPath)
    expect(bookService.text(gbk.id)).toBe('你好')
  })

  it('读取失败给出友好错误：不存在的书籍、非文本格式与缺失的文件', () => {
    const book = bookService.importFile(sourceTxt)
    const buffer = bookService.file(book.id)
    expect(new TextDecoder().decode(buffer)).toBe('第一段\n第二段')

    expect(() => bookService.text(999)).toThrow('书籍不存在')

    // PDF 等非文本格式不允许按文本读取
    const pdfPath = join(tempRoot, 'fake.pdf')
    writeFileSync(pdfPath, '%PDF-1.4 占位')
    const pdf = bookService.importFile(pdfPath)
    expect(() => bookService.text(pdf.id)).toThrow('该格式不支持文本读取')

    rmSync(join(tempRoot, 'data', 'books', book.fileName))
    expect(() => bookService.file(book.id)).toThrow('书籍文件不存在')
  })

  it('进度、元数据与移除：更新进度记录最近阅读时间，移除后级联清理文件与书签', () => {
    const book = bookService.importFile(sourceTxt)
    const updated = bookService.updateProgress(book.id, '42', 42)
    expect(updated?.progress).toBe(42)
    expect(updated?.location).toBe('42')
    expect(updated?.lastReadAt).not.toBe('')
    // 已读的书籍排在未读之前，未读按导入时间倒序
    const second = bookService.importFile(sourceTxt)
    expect(bookService.list().map((item) => item.id)).toEqual([book.id, second.id])
    bookService.updateProgress(second.id, '10', 10)
    expect(bookService.list()[0].id).toBe(second.id)

    const meta = bookService.updateMeta(book.id, {
      title: ' 新书名 ',
      author: '测试作者',
      cover: 'data:image/jpeg;base64,xxx'
    })
    expect(meta?.title).toBe('新书名')
    expect(meta?.author).toBe('测试作者')
    expect(meta?.cover).toBe('data:image/jpeg;base64,xxx')
    // 未提供的字段保留原值
    expect(bookService.updateMeta(book.id, {})?.author).toBe('测试作者')

    const filePath = join(tempRoot, 'data', 'books', book.fileName)
    bookmarkService.create({ bookId: book.id, location: '42', label: '位置', percent: 42 })
    bookService.remove(book.id)
    expect(bookService.get(book.id)).toBeNull()
    expect(existsSync(filePath)).toBe(false)
    expect(bookmarkService.list(book.id)).toHaveLength(0)
  })

  it('书签：按位置百分比排序，支持创建与删除，删除书籍时一并清理', () => {
    const book = bookService.importFile(sourceTxt)
    bookmarkService.create({ bookId: book.id, location: '50', label: '后段', percent: 50 })
    bookmarkService.create({ bookId: book.id, location: '10', label: '', percent: 10 })
    const list = bookmarkService.list(book.id)
    expect(list.map((item) => item.percent)).toEqual([10, 50])
    expect(list[1].label).toBe('后段')
    // 越界百分比自动钳制
    const clamped = bookmarkService.create({
      bookId: book.id,
      location: '120',
      label: '越界',
      percent: 120
    })
    expect(clamped.percent).toBe(100)

    bookmarkService.remove(list[0].id)
    expect(bookmarkService.list(book.id)).toHaveLength(2)
    expect(() =>
      bookmarkService.create({ bookId: 999, location: '1', label: '', percent: 1 })
    ).toThrow('书籍不存在')
  })

  it('阅读设置：默认值、非法值回退与越界钳制，并可持久化读取', () => {
    const defaults = settingsService.getReaderSettings()
    expect(defaults.fontSize).toBe(18)
    expect(defaults.theme).toBe('auto')
    expect(defaults.fontId).toBe('system')

    const saved = settingsService.setReaderSettings({
      fontId: 'song',
      fontSize: 99,
      lineHeight: 0.2,
      margin: 500,
      theme: 'sepia'
    })
    expect(saved.fontId).toBe('song')
    expect(saved.fontSize).toBe(30)
    expect(saved.lineHeight).toBe(1.4)
    expect(saved.margin).toBe(96)
    expect(saved.theme).toBe('sepia')
    expect(settingsService.getReaderSettings()).toEqual(saved)
  })

  it('更改数据存储位置时书籍文件一并迁移', async () => {
    const book = bookService.importFile(sourceTxt)
    const target = mkdtempSync(join(tmpdir(), 'workbench-reader-store-'))
    ;(dialog.showOpenDialog as Mock).mockResolvedValue({ canceled: false, filePaths: [target] })

    const newPath = await storageService.change(null)
    expect(newPath).toBe(join(target, 'Workbench', 'workbench.db'))
    expect(existsSync(join(target, 'Workbench', 'books', book.fileName))).toBe(true)
    // 新位置数据库可正常读取书库数据
    expect(bookService.get(book.id)?.title).toBe('sample-book')

    closeDb()
    rmSync(target, { recursive: true, force: true })
  })
})
