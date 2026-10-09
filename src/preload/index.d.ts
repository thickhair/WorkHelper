import type { WorkHelperApi } from './index'

declare global {
  interface Window {
    api: WorkHelperApi
  }
}

export {}