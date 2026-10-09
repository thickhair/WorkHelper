/**
 * 应用级状态：分类模块元数据、应用设置。
 */
import { defineStore } from 'pinia'
import type { AppSettings, ModuleInfo } from '@shared/types'

export const useAppStore = defineStore('app', {
  state: () => ({
    modules: [] as ModuleInfo[],
    settings: null as AppSettings | null,
    ready: false
  }),
  getters: {
    /** key → 模块信息 的映射，便于按路由参数查询 */
    moduleMap(state): Record<string, ModuleInfo> {
      return Object.fromEntries(state.modules.map((m) => [m.key, m]))
    },
    userName(state): string {
      return state.settings?.userName || '小伙伴'
    }
  },
  actions: {
    async init(): Promise<void> {
      const [modules, settings] = await Promise.all([
        window.api.modules.list(),
        window.api.app.getSettings()
      ])
      this.modules = modules
      this.settings = settings
      this.ready = true
    },
    async refreshModules(): Promise<void> {
      this.modules = await window.api.modules.list()
    },
    async setUserName(name: string): Promise<void> {
      await window.api.app.setUserName(name)
      if (this.settings) this.settings.userName = name
    }
  }
})