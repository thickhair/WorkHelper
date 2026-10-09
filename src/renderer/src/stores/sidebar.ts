/**
 * 侧边栏状态：按「功能广场」的配置动态生成导航项，并持久化到本地设置。
 */
import { defineStore } from 'pinia'
import {
  DEFAULT_SIDEBAR,
  FEATURE_CATALOG,
  normalizeSidebar,
  type FeatureDef
} from '@shared/features'

export const useSidebarStore = defineStore('sidebar', {
  state: () => ({
    /** 已添加到侧边栏的功能 id（默认仅「每日计划」） */
    enabled: [...DEFAULT_SIDEBAR] as string[],
    ready: false
  }),
  getters: {
    /** 当前显示在侧边栏的功能（按功能目录顺序） */
    items(state): FeatureDef[] {
      return FEATURE_CATALOG.filter((f) => state.enabled.includes(f.id))
    }
  },
  actions: {
    /** 功能是否显示在侧边栏 */
    isEnabled(id: string): boolean {
      return this.enabled.includes(id) && FEATURE_CATALOG.some((f) => f.id === id)
    },

    /** 首次启动时从设置中读取配置 */
    async init(): Promise<void> {
      if (this.ready) return
      const settings = await window.api.app.getSettings()
      this.enabled = normalizeSidebar(settings.sidebar)
      this.ready = true
    },

    /** 将功能添加到侧边栏 */
    async add(id: string): Promise<void> {
      if (!FEATURE_CATALOG.some((f) => f.id === id) || this.enabled.includes(id)) return
      await this.persist([...this.enabled, id])
    },

    /** 从侧边栏移除功能（数据不受影响，可在功能广场重新添加） */
    async remove(id: string): Promise<void> {
      if (!this.enabled.includes(id)) return
      await this.persist(this.enabled.filter((item) => item !== id))
    },

    /** 恢复默认配置（初始仅「每日计划」） */
    async restoreDefaults(): Promise<void> {
      await this.persist([...DEFAULT_SIDEBAR])
    },

    /** 保存到本地设置，并以主进程返回的规范化结果为准 */
    async persist(next: string[]): Promise<void> {
      this.enabled = await window.api.app.setSidebar(normalizeSidebar(next))
    }
  }
})