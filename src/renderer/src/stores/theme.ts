/**
 * 主题状态：负责应用 html[data-theme] 并将选择持久化到本地设置。
 */
import { defineStore } from 'pinia'
import { DEFAULT_THEME, normalizeTheme, THEME_CATALOG, type ThemeDef } from '@shared/themes'

/** 应用主题到文档根节点（CSS 通过 html[data-theme='xx'] 覆盖变量） */
function applyTheme(id: string): void {
  document.documentElement.dataset.theme = id
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    /** 当前主题 id */
    current: DEFAULT_THEME as string,
    /** 可选主题列表 */
    themes: THEME_CATALOG as ThemeDef[],
    ready: false
  }),
  getters: {
    /** 当前主题定义 */
    currentTheme(state): ThemeDef {
      return THEME_CATALOG.find((theme) => theme.id === state.current) ?? THEME_CATALOG[0]
    }
  },
  actions: {
    /** 启动时读取已保存的主题并应用 */
    async init(): Promise<void> {
      if (this.ready) return
      const settings = await window.api.app.getSettings()
      this.current = normalizeTheme(settings.theme)
      applyTheme(this.current)
      this.ready = true
    },

    /** 切换主题：立即生效并持久化 */
    async set(id: string): Promise<void> {
      const normalized = normalizeTheme(id)
      this.current = normalized
      applyTheme(normalized)
      this.current = await window.api.app.setTheme(normalized)
    },

    /** 不落库的本地应用（初始化失败时的兜底） */
    applyLocal(id: string): void {
      this.current = normalizeTheme(id)
      applyTheme(this.current)
    }
  }
})