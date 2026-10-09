/**
 * 功能目录：定义侧边栏与「功能广场」使用的功能项。
 * - 固定功能（首页 / 每日计划 / 日历 / 功能广场）始终显示在侧边栏顶部，不可移除；
 * - 可配置功能（资产）由用户在功能广场自由增删；
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

/** 功能目录（顺序即侧边栏显示顺序） */
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
    id: 'plan',
    name: '每日计划',
    icon: 'calendar',
    route: '/plan',
    desc: '日程、待办、习惯与专注一体化管理',
    group: 'core',
    tone: 'teal',
    style: 'soft',
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

/** 固定功能：始终显示在侧边栏顶部（首页 / 每日计划 / 日历 / 功能广场） */
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

/** 校验并规范化侧边栏配置：仅接受可配置功能，过滤未知 id 与重复项，并统一为目录顺序 */
export function normalizeSidebar(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_SIDEBAR]
  const allowed = new Set(CONFIGURABLE_IDS)
  const input = new Set(value.filter((v): v is string => typeof v === 'string' && allowed.has(v)))
  return CONFIGURABLE_IDS.filter((id) => input.has(id))
}

/** 按路由路径查找功能定义（设置不在目录中，返回 undefined 表示无需配置校验） */
export function featureByRoute(route: string): FeatureDef | undefined {
  return FEATURE_CATALOG.find((f) => f.route === route)
}