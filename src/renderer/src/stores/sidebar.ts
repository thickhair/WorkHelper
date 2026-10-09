/**
 * 侧边栏状态：固定功能（首页 / 每日计划 / 日历 / 功能广场）始终显示，
 * 可配置功能由「功能广场」自由增删，配置持久化到本地设置。
 */
import { defineStore } from 'pinia'
import {
  CONFIGURABLE_FEATURES,
  CONFIGURABLE_IDS,
  DEFAULT_SIDEBAR,
  FIXED_FEATURES,
  normalizeSidebar,
  type FeatureDef
} from '@shared/features'

export const useSidebarStore = defineStore('sidebar', {
  state: () => ({
    /** 已添加到侧边栏的可配置功能 id（默认无，固定功能不写入配置） */
    enabled: [...DEFAULT_SIDEBAR] as string[],
    ready: false
  }),
  getters: {
    /** 侧边栏条目：固定功能置顶，其后为已添加的可配置功能 */
    items(): FeatureDef[] {
      const extra = CONFIGURABLE_FEATURES.filter((f) => this.enabled.includes(f.id))
      return [...FIXED_FEATURES, ...extra]
    }
  },
  actions: {
    /** 功能是否显示在侧边栏（固定功能恒为 true） */
    isEnabled(id: string): boolean {
      if (FIXED_FEATURES.some((f) => f.id === id)) return true
      return this.enabled.includes(id) && CONFIGURABLE_IDS.includes(id)
    },

    /** 首次启动时从设置中读取配置（历史配置中的固定功能 id 会被自动过滤） */
    async init(): Promise<void> {
      if (this.ready) return
      const settings = await window.api.app.getSettings()
      this.enabled = normalizeSidebar(settings.sidebar)
      this.ready = true
    },

    /** 将功能添加到侧边栏（固定功能无需添加，忽略） */
    async add(id: string): Promise<void> {
      if (!CONFIGURABLE_IDS.includes(id) || this.enabled.includes(id)) return
      await this.persist([...this.enabled, id])
    },

    /** 从侧边栏移除功能（固定功能不可移除；数据不受影响，可在功能广场重新添加） */
    async remove(id: string): Promise<void> {
      if (!CONFIGURABLE_IDS.includes(id) || !this.enabled.includes(id)) return
      await this.persist(this.enabled.filter((item) => item !== id))
    },

    /** 恢复默认配置（清空可配置功能，仅保留固定功能） */
    async restoreDefaults(): Promise<void> {
      await this.persist([...DEFAULT_SIDEBAR])
    },

    /** 保存到本地设置，并以主进程返回的规范化结果为准 */
    async persist(next: string[]): Promise<void> {
      this.enabled = await window.api.app.setSidebar(next)
    }
  }
})