/**
 * 功能目录（功能广场）：定义可自由添加到侧边栏的功能项与默认配置。
 * 主进程与渲染进程共用：主进程用于校验持久化配置，渲染层用于渲染侧边栏与功能广场。
 */

/** 功能分组 */
export type FeatureGroup = 'core' | 'learn' | 'tool' | 'system'

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
  /** 固定显示在侧边栏（不可移除） */
  fixed?: boolean
  /** 默认是否添加到侧边栏 */
  defaultEnabled: boolean
}

/** 分组标题 */
export const FEATURE_GROUP_LABELS: Record<FeatureGroup, string> = {
  core: '常用功能',
  learn: '学习模块',
  tool: '实用工具',
  system: '系统功能'
}

/** 功能目录（顺序即侧边栏默认显示顺序） */
export const FEATURE_CATALOG: FeatureDef[] = [
  {
    id: 'home',
    name: '首页',
    icon: 'home',
    route: '/',
    desc: '今日概览与快捷入口',
    group: 'core',
    fixed: true,
    defaultEnabled: true
  },
  {
    id: 'plan',
    name: '每日计划',
    icon: 'calendar',
    route: '/plan',
    desc: '日程、待办、习惯与专注一体化管理',
    group: 'core',
    defaultEnabled: true
  },
  {
    id: 'm-fitness',
    name: '减肥运动',
    icon: 'run',
    route: '/m/fitness',
    desc: '运动投入记录与体重管理',
    group: 'learn',
    defaultEnabled: true
  },
  {
    id: 'm-english',
    name: '英语学习',
    icon: 'book',
    route: '/m/english',
    desc: '单词、听力与口语练习记录',
    group: 'learn',
    defaultEnabled: true
  },
  {
    id: 'm-editing',
    name: '剪辑学习',
    icon: 'film',
    route: '/m/editing',
    desc: '剪辑课程与练习进度',
    group: 'learn',
    defaultEnabled: true
  },
  {
    id: 'm-podcast',
    name: '播客精选',
    icon: 'headphone',
    route: '/m/podcast',
    desc: '播客收听与要点摘录',
    group: 'learn',
    defaultEnabled: true
  },
  {
    id: 'm-expression',
    name: '表达能力',
    icon: 'chat',
    route: '/m/expression',
    desc: '表达训练与练习复盘',
    group: 'learn',
    defaultEnabled: true
  },
  {
    id: 'm-reading',
    name: '读书推荐',
    icon: 'books',
    route: '/m/reading',
    desc: '阅读进度与读书笔记',
    group: 'learn',
    defaultEnabled: true
  },
  {
    id: 'm-fashion',
    name: '妆容穿搭',
    icon: 'shirt',
    route: '/m/fashion',
    desc: '穿搭灵感与妆容练习',
    group: 'learn',
    defaultEnabled: true
  },
  {
    id: 'm-creation',
    name: '爆款二创',
    icon: 'fire',
    route: '/m/creation',
    desc: '爆款拆解与二次创作练习',
    group: 'learn',
    defaultEnabled: true
  },
  {
    id: 'm-ai',
    name: 'AI学习',
    icon: 'robot',
    route: '/m/ai',
    desc: 'AI 工具学习与实践记录',
    group: 'learn',
    defaultEnabled: true
  },
  {
    id: 'news',
    name: '新闻资讯',
    icon: 'news',
    route: '/news',
    desc: '资讯收集、标签与收藏',
    group: 'tool',
    defaultEnabled: true
  },
  {
    id: 'review',
    name: '工作复盘',
    icon: 'notebook',
    route: '/review',
    desc: '用文字沉淀每天的收获与改进',
    group: 'tool',
    defaultEnabled: true
  },
  {
    id: 'stats',
    name: '数据统计',
    icon: 'chart',
    route: '/stats',
    desc: '完成率、趋势与投入时长一览',
    group: 'tool',
    defaultEnabled: true
  },
  {
    id: 'focus',
    name: '专注空间',
    icon: 'target',
    route: '/focus',
    desc: '番茄式专注计时，记录每一段专注',
    group: 'tool',
    defaultEnabled: false
  },
  {
    id: 'plaza',
    name: '功能广场',
    icon: 'grid',
    route: '/plaza',
    desc: '自由添加或移除侧边栏功能',
    group: 'system',
    fixed: true,
    defaultEnabled: true
  },
  {
    id: 'settings',
    name: '设置',
    icon: 'settings',
    route: '/settings',
    desc: '个性化与数据安全',
    group: 'system',
    fixed: true,
    defaultEnabled: true
  }
]

/** 可自定义（非固定）的功能 id 列表，按目录顺序排列 */
export const TOGGLEABLE_IDS: string[] = FEATURE_CATALOG.filter((f) => !f.fixed).map((f) => f.id)

/** 默认侧边栏配置 */
export const DEFAULT_SIDEBAR: string[] = FEATURE_CATALOG.filter(
  (f) => !f.fixed && f.defaultEnabled
).map((f) => f.id)

/** 校验并规范化侧边栏配置：过滤未知 id 与重复项，并统一为目录顺序 */
export function normalizeSidebar(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_SIDEBAR]
  const allowed = new Set(TOGGLEABLE_IDS)
  const input = new Set(value.filter((v): v is string => typeof v === 'string' && allowed.has(v)))
  return TOGGLEABLE_IDS.filter((id) => input.has(id))
}

/** 判断功能是否显示在侧边栏（固定功能始终显示） */
export function isFeatureEnabled(enabledIds: string[], id: string): boolean {
  const def = FEATURE_CATALOG.find((f) => f.id === id)
  if (!def) return false
  return def.fixed === true || enabledIds.includes(id)
}

/** 按路由路径查找功能定义 */
export function featureByRoute(route: string): FeatureDef | undefined {
  return FEATURE_CATALOG.find((f) => f.route === route)
}