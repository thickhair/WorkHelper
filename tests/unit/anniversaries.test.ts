/**
 * 倒数日 / 纪念日与资产共享层纯函数测试：
 * 输入校验、发生日期换算（含 2/29 平年回退）、剩余天数与周年计算、金额格式化。
 */
import { describe, expect, it } from 'vitest'
import {
  daysUntilOccurrence,
  nextOccurrence,
  normalizeAnniversary,
  occurrenceInYear,
  upcomingYearCount,
  untilText,
  type Anniversary
} from '@shared/anniversaries'
import {
  ASSET_PLATFORMS,
  categoriesOf,
  EXPENSE_CATEGORIES,
  formatMoney,
  formatMoneyShort,
  INCOME_CATEGORIES,
  platformOf
} from '@shared/assets'

const TODAY = '2026-10-09'

function makeItem(patch: Partial<Anniversary>): Anniversary {
  return {
    id: 1,
    name: '测试',
    kind: 'anniversary',
    year: null,
    month: 10,
    day: 9,
    note: '',
    createdAt: '',
    ...patch
  }
}

describe('纪念日输入校验', () => {
  it('合法输入被规范化（名称与备注去空白）', () => {
    const result = normalizeAnniversary({
      name: '  结婚纪念日  ',
      kind: 'anniversary',
      year: null,
      month: 5,
      day: 20,
      note: '  订餐厅 '
    })
    expect(result.name).toBe('结婚纪念日')
    expect(result.note).toBe('订餐厅')
    expect(result.year).toBeNull()
  })

  it('空名称、非法月日、非法年份分别报错', () => {
    const base = { name: 'x', kind: 'anniversary' as const, year: null, month: 5, day: 20, note: '' }
    expect(() => normalizeAnniversary({ ...base, name: '   ' })).toThrow('请填写名称')
    expect(() => normalizeAnniversary({ ...base, month: 13 })).toThrow('月份需在 1-12 之间')
    expect(() => normalizeAnniversary({ ...base, month: 2, day: 30 })).toThrow('日期需在 1-29 之间')
    expect(() => normalizeAnniversary({ ...base, year: 1800 })).toThrow('年份需在 1900-2200 之间')
  })

  it('倒数日必须包含年份，纪念日年份可空', () => {
    const base = { name: 'x', year: null, month: 5, day: 20, note: '' }
    expect(() => normalizeAnniversary({ ...base, kind: 'countdown' })).toThrow('含年份')
    expect(normalizeAnniversary({ ...base, kind: 'anniversary' }).year).toBeNull()
  })
})

describe('发生日期与剩余天数', () => {
  it('纪念日在今年未过时取今年，已过时取明年', () => {
    const future = makeItem({ month: 12, day: 25 })
    const past = makeItem({ month: 1, day: 1 })
    expect(nextOccurrence(future, TODAY)).toBe('2026-12-25')
    expect(nextOccurrence(past, TODAY)).toBe('2027-01-01')
  })

  it('2 月 29 日纪念日在平年回退为 2 月 28 日', () => {
    const leap = makeItem({ month: 2, day: 29 })
    expect(occurrenceInYear(leap, 2028)).toBe('2028-02-29')
    expect(occurrenceInYear(leap, 2027)).toBe('2027-02-28')
    expect(nextOccurrence(leap, TODAY)).toBe('2027-02-28')
  })

  it('倒数日指向固定日期，过期后返回负天数', () => {
    const future = makeItem({ kind: 'countdown', year: 2026, month: 10, day: 19 })
    const past = makeItem({ kind: 'countdown', year: 2026, month: 10, day: 1 })
    expect(nextOccurrence(future, TODAY)).toBe('2026-10-19')
    expect(daysUntilOccurrence(future, TODAY)).toBe(10)
    expect(nextOccurrence(past, TODAY)).toBe('2026-10-01')
    expect(daysUntilOccurrence(past, TODAY)).toBe(-8)
  })

  it('周年数仅在记录了起始年份的纪念日可用', () => {
    const withYear = makeItem({ kind: 'anniversary', year: 2020, month: 12, day: 25 })
    const noYear = makeItem({ kind: 'anniversary', year: null, month: 12, day: 25 })
    const countdown = makeItem({ kind: 'countdown', year: 2026, month: 12, day: 25 })
    expect(upcomingYearCount(withYear, TODAY)).toBe(6)
    expect(upcomingYearCount(noYear, TODAY)).toBeNull()
    expect(upcomingYearCount(countdown, TODAY)).toBeNull()
  })

  it('剩余天数文案', () => {
    expect(untilText(0)).toBe('就是今天')
    expect(untilText(1)).toBe('明天')
    expect(untilText(10)).toBe('还有 10 天')
    expect(untilText(-3)).toBe('已过 3 天')
  })
})

describe('资产平台与金额格式化', () => {
  it('平台目录覆盖主流支付平台与 15 家银行，未知 key 回退「其他平台」', () => {
    const keys = ASSET_PLATFORMS.map((p) => p.key)
    for (const key of [
      'alipay',
      'wechat',
      'jd',
      'unionpay',
      'meituan',
      'douyin',
      'icbc',
      'ccb',
      'abc',
      'boc',
      'cmb',
      'bocom',
      'psbc',
      'citic',
      'spdb',
      'cmbc',
      'ceb',
      'cib',
      'pab',
      'hxb',
      'cgb',
      'cash'
    ]) {
      expect(keys).toContain(key)
    }
    // 平台数量（含现金与其他平台共 23 项），且银行共 15 家
    expect(ASSET_PLATFORMS.length).toBeGreaterThanOrEqual(20)
    expect(ASSET_PLATFORMS.filter((p) => p.name.endsWith('银行'))).toHaveLength(15)
    // 回退平台必须位于最后一位
    expect(ASSET_PLATFORMS[ASSET_PLATFORMS.length - 1].key).toBe('other')
    expect(platformOf('alipay').name).toBe('支付宝')
    expect(platformOf('not-exist').key).toBe('other')
    // 每个平台都有品牌色与徽章字形
    for (const platform of ASSET_PLATFORMS) {
      expect(platform.color).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(platform.glyph.length).toBeGreaterThan(0)
    }
  })

  it('收支分类目录按类型返回', () => {
    expect(categoriesOf('income')).toEqual(INCOME_CATEGORIES)
    expect(categoriesOf('expense')).toEqual(EXPENSE_CATEGORIES)
    expect(INCOME_CATEGORIES).toContain('工资')
    expect(EXPENSE_CATEGORIES).toContain('餐饮')
  })

  it('金额格式化为千分位两位小数', () => {
    expect(formatMoney(0)).toBe('0.00')
    expect(formatMoney(12340.5)).toBe('12,340.50')
    expect(formatMoney(-99.9)).toBe('-99.90')
    expect(formatMoney(1000000)).toBe('1,000,000.00')
    expect(formatMoney(Number.NaN)).toBe('0.00')
  })

  it('金额精简格式化（图表轴标签）', () => {
    expect(formatMoneyShort(9999)).toBe('9999')
    expect(formatMoneyShort(10000)).toBe('1万')
    expect(formatMoneyShort(25800)).toBe('2.6万')
    expect(formatMoneyShort(-32000)).toBe('-3.2万')
  })
})
