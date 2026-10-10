/**
 * 功能目录：定义侧边栏与「功能广场」使用的功能项。
 * - 固定功能（首页 / 日历 / 功能广场）始终显示在侧边栏顶部，不可移除；
 * - 可配置功能（资产 / 阅读）由用户在功能广场自由增删，并可在侧边栏中拖拽调整先后顺序；
 * - 「设置」不在目录中，入口位于窗口右上角。
 * 主进程与渲染进程共用：主进程用于校验持久化配置，渲染层用于渲染侧边栏与功能广场。
 */

/** 功能分组 */
export type FeatureGroup = 'core' | 'tool' | 'system'

/** 功能色调（功能广场图标配色，见 PlazaView） */
export type FeatureTone =
  | 'green'
  | 'teal'
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'pink'
  | 'rose'
  | 'orange'
  | 'amber'
  | 'slate'

/** 功能图标徽章样式（功能广场） */
export type FeatureStyle = 'solid' | 'soft' | 'ring'

/** 功能定义 */
export interface FeatureDef {
  /** 唯一标识（持久化使用） */
  id: string
  /** 功能名称 */
  name: string
  /** 图标名（见 renderer/components/icons.ts） */
  icon: string
  /** 路由路径 */
  route: string
  /** 功能广场中的描述 */
  desc: string
  /** 功能广场分组 */
  group: FeatureGroup
  /** 功能广场图标色调 */
  tone: FeatureTone
  /** 功能广场图标徽章样式 */
  style: FeatureStyle
  /** 固定功能：始终显示在侧边栏顶部，不可添加或移除 */
  fixed?: boolean
}

/** 分组标题 */
export const FEATURE_GROUP_LABELS: Record<FeatureGroup, string> = {
  core: '常用功能',
  tool: '实用工具',
  system: '系统功能'
}

/** 功能目录（默认顺序；可配置功能的实际顺序以用户拖拽后的持久化配置为准） */
export const FEATURE_CATALOG: FeatureDef[] = [
  {
    id: 'home',
    name: '首页',
    icon: 'home',
    route: '/',
    desc: '今日概览与快捷入口',
    group: 'core',
    tone: 'green',
    style: 'solid',
    fixed: true
  },
  {
    id: 'calendar',
    name: '日历',
    icon: 'calendarDays',
    route: '/calendar',
    desc: '节假日、农历、天气、心情与生日提醒',
    group: 'core',
    tone: 'blue',
    style: 'solid',
    fixed: true
  },
  {
    id: 'assets',
    name: '资产',
    icon: 'wallet',
    route: '/assets',
    desc: '多平台账户、收支统计与攒钱计划',
    group: 'tool',
    tone: 'amber',
    style: 'solid'
  },
  {
    id: 'reader',
    name: '阅读',
    icon: 'books',
    route: '/reader',
    desc: '本地电子书阅读：EPUB / PDF / TXT / Markdown',
    group: 'tool',
    tone: 'teal',
    style: 'soft'
  },
  {
    id: 'plaza',
    name: '功能广场',
    icon: 'grid',
    route: '/plaza',
    desc: '自由添加或移除侧边栏功能',
    group: 'system',
    tone: 'violet',
    style: 'ring',
    fixed: true
  }
]

/** 固定功能：始终显示在侧边栏顶部（首页 / 日历 / 功能广场） */
export const FIXED_FEATURES: FeatureDef[] = FEATURE_CATALOG.filter((f) => f.fixed)

/** 可配置功能：由用户在「功能广场」自由添加或移除 */
export const CONFIGURABLE_FEATURES: FeatureDef[] = FEATURE_CATALOG.filter((f) => !f.fixed)

/** 固定功能的 id 列表（按目录顺序） */
export const FIXED_SIDEBAR: string[] = FIXED_FEATURES.map((f) => f.id)

/** 可配置功能的 id 列表（按目录顺序） */
export const CONFIGURABLE_IDS: string[] = CONFIGURABLE_FEATURES.map((f) => f.id)

/** 默认侧边栏配置：可配置功能默认不添加到侧边栏（固定功能无需配置，始终显示） */
export const DEFAULT_SIDEBAR: string[] = []

/** 是否为固定功能 */
export function isFixedFeature(id: string): boolean {
  return FIXED_SIDEBAR.includes(id)
}

/**
 * 过滤并去重 id 列表：仅保留字符串且在允许集合中的条目，
 * 保留输入顺序（重复项保留首次出现的位置）。
 */
export function filterKnownIds(value: unknown, allowed: readonly string[]): string[] {
  if (!Array.isArray(value)) return []
  const allowedSet = new Set(allowed)
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of value) {
    if (typeof item !== 'string' || !allowedSet.has(item) || seen.has(item)) continue
    seen.add(item)
    result.push(item)
  }
  return result
}

/** 校验并规范化侧边栏配置：仅接受可配置功能，过滤未知 id 与重复项，并保留配置顺序（拖拽排序结果） */
export function normalizeSidebar(value: unknown): string[] {
  return filterKnownIds(value, CONFIGURABLE_IDS)
}

/**
 * 拖拽排序：把 fromId 移动到 targetId 之前（after=false）或之后（after=true）。
 * 任一 id 不存在、两者相同或列表不足两项时返回原顺序的副本。
 */
export function reorderSidebar(
  list: string[],
  fromId: string,
  targetId: string,
  after: boolean
): string[] {
  const next = [...list]
  if (list.length < 2 || fromId === targetId) return next
  const fromIndex = next.indexOf(fromId)
  if (fromIndex < 0) return next
  next.splice(fromIndex, 1)
  const targetIndex = next.indexOf(targetId)
  if (targetIndex < 0) return [...list]
  next.splice(targetIndex + (after ? 1 : 0), 0, fromId)
  return next
}

/** 按路由路径查找功能定义（设置不在目录中，返回 undefined 表示无需配置校验） */
export function featureByRoute(route: string): FeatureDef | undefined {
  return FEATURE_CATALOG.find((f) => f.route === route)
}

/**
 * 按实际访问路径查找功能定义：支持功能页面下的子路径
 * （如「阅读」书架下的阅读页 `/reader/book/1`）。
 * 未命中任何功能时返回 undefined（设置等直接放行）。
 */
export function featureByPath(path: string): FeatureDef | undefined {
  const exact = featureByRoute(path)
  if (exact) return exact
  return FEATURE_CATALOG.find((f) => f.route !== '/' && path.startsWith(`${f.route}/`))
}