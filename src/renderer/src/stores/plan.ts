/**
 * 每日计划状态：按日期加载日程、习惯与统计，
 * 并封装所有增删改操作（操作后自动刷新相关数据）。
 */
import { defineStore } from 'pinia'
import type { DayStats, HabitInput, HabitWithProgress, Schedule, ScheduleInput } from '@shared/types'
import { formatDate } from '@shared/logic'

export const usePlanStore = defineStore('plan', {
  state: () => ({
    date: formatDate(new Date()),
    schedules: [] as Schedule[],
    habits: [] as HabitWithProgress[],
    stats: null as DayStats | null,
    loading: false
  }),

  actions: {
    /** 加载指定日期（默认当前选中日期）的全部数据 */
    async load(date?: string): Promise<void> {
      if (date) this.date = date
      this.loading = true
      try {
        const [schedules, habits, stats] = await Promise.all([
          window.api.schedules.list(this.date),
          window.api.habits.list(this.date),
          window.api.stats.day(this.date)
        ])
        this.schedules = schedules
        this.habits = habits
        this.stats = stats
      } finally {
        this.loading = false
      }
    },

    /** 重新计算当日统计（日程或习惯变更后调用） */
    async refreshStats(): Promise<void> {
      this.stats = await window.api.stats.day(this.date)
    },

    /* ------------------------------ 日程 ------------------------------ */
    async addSchedule(input: ScheduleInput): Promise<void> {
      await window.api.schedules.create(input)
      await this.load()
    },
    async updateSchedule(id: number, patch: Partial<ScheduleInput>): Promise<void> {
      await window.api.schedules.update(id, patch)
      await this.load()
    },
    async toggleSchedule(id: number, done: boolean): Promise<void> {
      const updated = await window.api.schedules.toggle(id, done)
      this.schedules = this.schedules.map((s) => (s.id === id ? updated : s))
      await this.refreshStats()
    },
    async removeSchedule(id: number): Promise<void> {
      await window.api.schedules.remove(id)
      await this.load()
    },

    /** 按给定顺序重编号「未设置时间」的日程（首页拖拽落位后调用） */
    async reorderSchedules(ids: number[]): Promise<void> {
      await window.api.schedules.reorder(ids)
      await this.load()
    },

    /* ---------------------------- 习惯打卡 ---------------------------- */
    /** 打卡：delta 为 +1（打卡）/ -1（撤销） */
    async checkInHabit(id: number, delta: number): Promise<void> {
      const updated = await window.api.habits.checkIn(id, this.date, delta)
      this.habits = this.habits.map((h) => (h.id === id ? updated : h))
      await this.refreshStats()
    },
    async addHabit(input: HabitInput): Promise<void> {
      await window.api.habits.create(input)
      await this.load()
    },
    async updateHabit(id: number, patch: Partial<HabitInput>): Promise<void> {
      await window.api.habits.update(id, patch)
      await this.load()
    },
    async removeHabit(id: number): Promise<void> {
      await window.api.habits.remove(id)
      await this.load()
    }
  }
})