/**
 * 侧边栏状态：固定功能（首页 / 日历 / 功能广场）始终显示，
 * 可配置功能由「功能广场」自由增删，并可在侧边栏中拖拽调整先后顺序，
 * 配置（含顺序）持久化到本地设置。
 */
import { defineStore } from 'pinia'
import {
  CONFIGURABLE_FEATURES,
  CONFIGURABLE_IDS,
  DEFAULT_SIDEBAR,
  FIXED_FEATURES,
  normalizeSidebar,
  reorderSidebar,
  type FeatureDef
} from '@shared/features'

/** 侧边栏收尾功能：固定排在最后（可配置功能从功能广场添加后显示在其上方） */
const TAIL_FEATURE_ID = 'plaza'

export const useSidebarStore = defineStore('sidebar', {
  state: () => ({
    /** 已添加到侧边栏的可配置功能 id（按侧边栏显示顺序；固定功能不写入配置） */
    enabled: [...DEFAULT_SIDEBAR] as string[],
    ready: false
  }),
  getters: {
    /** 侧边栏条目：首页 / 日历置顶，可配置功能按用户配置顺序居中，功能广场收尾 */
    items(): FeatureDef[] {
      const head = FIXED_FEATURES.filter((f) => f.id !== TAIL_FEATURE_ID)
      const tail = FIXED_FEATURES.filter((f) => f.id === TAIL_FEATURE_ID)
      const extra = this.enabled
        .map((id) => CONFIGURABLE_FEATURES.find((f) => f.id === id))
        .filter((f): f is FeatureDef => Boolean(f))
      return [...head, ...extra, ...tail]
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

    /**
     * 拖拽排序：把功能移到目标功能之前 / 之后（仅可配置功能；顺序即侧边栏显示顺序）。
     * 目标无效或原地移动时不触发持久化。
     */
    async move(fromId: string, targetId: string, after: boolean): Promise<void> {
      if (
        fromId === targetId ||
        !this.enabled.includes(fromId) ||
        !this.enabled.includes(targetId)
      ) {
        return
      }
      const next = reorderSidebar(this.enabled, fromId, targetId, after)
      if (next.every((id, index) => id === this.enabled[index])) return
      await this.persist(next)
    },

    /** 保存到本地设置，并以主进程返回的规范化结果为准 */
    async persist(next: string[]): Promise<void> {
      this.enabled = await window.api.app.setSidebar(next)
    }
  }
})