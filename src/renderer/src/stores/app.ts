/**
 * 应用级状态：应用设置（用户名等）。
 */
import { defineStore } from 'pinia'
import type { AppSettings } from '@shared/types'

export const useAppStore = defineStore('app', {
  state: () => ({
    settings: null as AppSettings | null,
    ready: false
  }),
  getters: {
    userName(state): string {
      return state.settings?.userName || '小伙伴'
    }
  },
  actions: {
    async init(): Promise<void> {
      this.settings = await window.api.app.getSettings()
      this.ready = true
    },
    async setUserName(name: string): Promise<void> {
      await window.api.app.setUserName(name)
      if (this.settings) this.settings.userName = name
    }
  }
})
