/**
 * 轻提示（Toast）状态管理：用于操作成功/失败反馈。
 */
import { defineStore } from 'pinia'

export interface ToastItem {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

let seed = 0

export const useToastStore = defineStore('toast', {
  state: () => ({
    items: [] as ToastItem[]
  }),
  actions: {
    push(message: string, type: ToastItem['type'] = 'success'): void {
      const id = ++seed
      this.items.push({ id, message, type })
      setTimeout(() => this.dismiss(id), 2400)
    },
    success(message: string): void {
      this.push(message, 'success')
    },
    error(message: string): void {
      this.push(message, 'error')
    },
    dismiss(id: number): void {
      this.items = this.items.filter((item) => item.id !== id)
    }
  }
})