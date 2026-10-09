/**
 * 主题目录：设置页可选的多套配色主题。
 * 主进程与渲染进程共用：主进程用于校验持久化配置，渲染层用于应用 data-theme 与渲染选项。
 */

/** 主题定义 */
export interface ThemeDef {
  /** 主题标识（对应 html[data-theme]） */
  id: string
  /** 主题名称 */
  name: string
  /** 主题描述 */
  desc: string
  /** 预览色块：[侧边栏, 主色, 背景] */
  swatch: [string, string, string]
  /** 是否为深色主题 */
  dark?: boolean
}

/** 主题目录（顺序即设置页展示顺序，第一个为默认主题） */
export const THEME_CATALOG: ThemeDef[] = [
  {
    id: 'forest',
    name: '森林绿',
    desc: '清新自然的默认主题',
    swatch: ['#56A76C', '#4C9A62', '#F3F7F3']
  },
  {
    id: 'ocean',
    name: '海洋蓝',
    desc: '沉静专注的蓝色系',
    swatch: ['#3A8CC0', '#3A8CC0', '#F2F7FB']
  },
  {
    id: 'sakura',
    name: '樱花粉',
    desc: '温柔明亮的粉调',
    swatch: ['#C9638A', '#C9638A', '#FBF4F7']
  },
  {
    id: 'sunset',
    name: '暖阳橙',
    desc: '温暖活力的橙调',
    swatch: ['#CC7A33', '#CC7A33', '#FCF6EF']
  },
  {
    id: 'violet',
    name: '紫罗兰',
    desc: '优雅安静的紫色系',
    swatch: ['#7565BE', '#7565BE', '#F5F4FB']
  },
  {
    id: 'midnight',
    name: '暗夜黑',
    desc: '深色界面，夜间更护眼',
    swatch: ['#1E2831', '#4FC494', '#12171C'],
    dark: true
  }
]

/** 默认主题 id */
export const DEFAULT_THEME = 'forest'

/** 校验主题 id 是否合法 */
export function isThemeId(value: unknown): value is string {
  return typeof value === 'string' && THEME_CATALOG.some((theme) => theme.id === value)
}

/** 规范化主题 id：非法值回退为默认主题 */
export function normalizeTheme(value: unknown): string {
  return isThemeId(value) ? value : DEFAULT_THEME
}