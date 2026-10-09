// @vitest-environment jsdom
/**
 * 资产页面冒烟测试：以接近验证库的数据挂载，捕捉渲染期运行时错误。
 */
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AssetsView from '../../src/renderer/src/views/AssetsView.vue'

const accounts = [
  { id: 1, platform: 'alipay', name: '支付宝', balance: 12340.5, note: '日常花销', sortOrder: 0, createdAt: '', updatedAt: '' },
  { id: 2, platform: 'wechat', name: '微信零钱', balance: 2680, note: '', sortOrder: 1, createdAt: '', updatedAt: '' },
  { id: 3, platform: 'icbc', name: '工商储蓄卡', balance: 56000, note: '工资卡', sortOrder: 2, createdAt: '', updatedAt: '' },
  { id: 4, platform: 'cmb', name: '招商信用卡', balance: -3200, note: '待还款', sortOrder: 3, createdAt: '', updatedAt: '' }
]

const records = [
  { id: 1, accountId: 3, kind: 'income', category: '工资', amount: 15000, date: '2026-10-01', note: '', createdAt: '', accountName: '工商储蓄卡' },
  { id: 2, accountId: 1, kind: 'expense', category: '餐饮', amount: 45.5, date: '2026-10-09', note: '午餐', createdAt: '', accountName: '支付宝' }
]

const goals = [
  { id: 1, kind: 'plan', name: '应急基金', target: 30000, period: 'monthly', perAmount: 2500, startDate: '2026-08-10', note: '', done: 0, createdAt: '', saved: 5000, percent: 17 },
  { id: 2, kind: 'wish', name: 'MacBook Pro', target: 15999, period: 'weekly', perAmount: 800, startDate: '2026-09-18', note: '', done: 0, createdAt: '', saved: 2600, percent: 16 }
]

const apiMock = {
  assets: {
    accounts: vi.fn(async () => accounts),
    records: vi.fn(async () => records),
    summary: vi.fn(async () => ({ total: 67820.5, accountCount: 4, monthIncome: 15320.5, monthExpense: 568.5 })),
    trend: vi.fn(async () => [{ date: '2026-10-09', income: 0, expense: 69.5, total: 67820.5 }]),
    categoryStats: vi.fn(async () => [{ category: '餐饮', amount: 131.5 }])
  },
  savings: {
    list: vi.fn(async () => goals),
    deposits: vi.fn(async () => [])
  }
}

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/assets', component: { template: '<div />' } }]
})

beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
  ;(window as unknown as { api: unknown }).api = apiMock
})

describe('资产页面', () => {
  it('挂载渲染概览、账户与记录（含负余额账户）', async () => {
    const errors: unknown[] = []
    const wrapper = mount(AssetsView, {
      global: {
        plugins: [router],
        config: {
          errorHandler: (err) => errors.push(err)
        }
      }
    })
    await flushPromises()

    expect(errors).toEqual([])
    const text = wrapper.text()
    expect(text).toContain('支付宝')
    expect(text).toContain('工商储蓄卡')
    // 金额默认隐藏，点击眼睛按钮后显示实际金额
    expect(text).toContain('¥****')
    expect(text).not.toContain('12,340.50')
    const eyeBtn = wrapper.find('.eye-btn')
    expect(eyeBtn.exists()).toBe(true)
    await eyeBtn.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('12,340.50')
    expect(wrapper.text()).toContain('67,820.50')
  })
})
