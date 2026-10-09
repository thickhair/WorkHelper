/**
 * 资产共享模块：平台目录（品牌色与图标字形）、收支分类与金额格式化。
 * 平台图标为自绘品牌色 SVG（离线可用），见 renderer/components/PlatformIcon.vue。
 */

/** 资产平台定义 */
export interface AssetPlatform {
  /** 平台唯一标识（持久化使用） */
  key: string
  /** 平台名称 */
  name: string
  /** 品牌主色（徽章底色） */
  color: string
  /** 徽章字形（1-2 个字符，白字显示在品牌色徽章上） */
  glyph: string
}

/** 内置平台目录（覆盖主流银行与常用支付 / 金融平台） */
export const ASSET_PLATFORMS: AssetPlatform[] = [
  { key: 'alipay', name: '支付宝', color: '#1677FF', glyph: '支' },
  { key: 'wechat', name: '微信支付', color: '#07C160', glyph: '微' },
  { key: 'jd', name: '京东金融', color: '#E1251B', glyph: '京' },
  { key: 'icbc', name: '工商银行', color: '#C7000B', glyph: '工' },
  { key: 'ccb', name: '建设银行', color: '#0066B3', glyph: '建' },
  { key: 'abc', name: '农业银行', color: '#008566', glyph: '农' },
  { key: 'boc', name: '中国银行', color: '#A71E32', glyph: '中' },
  { key: 'cmb', name: '招商银行', color: '#E60012', glyph: '招' },
  { key: 'bocom', name: '交通银行', color: '#003DA5', glyph: '交' },
  { key: 'psbc', name: '邮储银行', color: '#007A3D', glyph: '邮' },
  { key: 'cash', name: '现金', color: '#8C6D1F', glyph: '现' },
  { key: 'other', name: '其他平台', color: '#6B7280', glyph: '其' }
]

/** 按 key 查找平台（未知 key 回退「其他平台」） */
export function platformOf(key: string): AssetPlatform {
  return ASSET_PLATFORMS.find((p) => p.key === key) ?? ASSET_PLATFORMS[ASSET_PLATFORMS.length - 1]
}

/** 收入分类 */
export const INCOME_CATEGORIES = [
  '工资',
  '奖金',
  '兼职',
  '理财收益',
  '红包转账',
  '报销退款',
  '其他收入'
]

/** 支出分类 */
export const EXPENSE_CATEGORIES = [
  '餐饮',
  '购物',
  '交通',
  '住房',
  '娱乐',
  '医疗',
  '教育',
  '人情',
  '其他支出'
]

/** 收支记录类型 */
export type AssetRecordKind = 'income' | 'expense'

/** 按收支类型返回分类目录 */
export function categoriesOf(kind: AssetRecordKind): string[] {
  return kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
}

/** 金额格式化：保留两位小数并加分千位（如 12,340.50） */
export function formatMoney(value: number): string {
  const fixed = (Number.isFinite(value) ? value : 0).toFixed(2)
  const [intPart, decPart] = fixed.split('.')
  const sign = intPart.startsWith('-') ? '-' : ''
  const digits = sign ? intPart.slice(1) : intPart
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${sign}${grouped}.${decPart}`
}

/** 金额精简格式化（图表轴标签用）：>=1 万时显示「x.x万」 */
export function formatMoneyShort(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 10000) return `${(value / 10000).toFixed(1).replace(/\.0$/, '')}万`
  return `${Math.round(value)}`
}
