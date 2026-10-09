/**
 * 每日计划状态：按日期加载日程、待办、习惯、重要事项与统计，
 * 并封装所有增删改操作（操作后自动刷新相关数据）。
 */
import { defineStore } from 'pinia'
import type {
  DayStats,
  HabitInput,
  HabitWithProgress,
  PriorityInput,
  PriorityTask,
  Schedule,
  ScheduleInput,
  Todo,
  TodoInput
} from '@shared/types'
import { formatDate, nextTaskOf } from '@shared/logic'

export const usePlanStore = defineStore('plan', {
  state: () => ({
    date: formatDate(new Date()),
    schedules: [] as Schedule[],
    todos: [] as Todo[],
    habits: [] as HabitWithProgress[],
    priorities: [] as PriorityTask[],
    stats: null as DayStats | null,
    loading: false
  }),

  getters: {
    /** 下一个待完成的日程（用于「下一个任务」卡片） */
    nextTask(state): Schedule | null {
      return nextTaskOf(state.schedules)
    },
    /** 待办剩余数量 */
    todoLeft(state): number {
      return state.todos.filter((t) => !t.done).length
    }
  },

  actions: {
    /** 加载指定日期（默认当前选中日期）的全部数据 */
    async load(date?: string): Promise<void> {
      if (date) this.date = date
      this.loading = true
      try {
        const [schedules, todos, habits, priorities, stats] = await Promise.all([
          window.api.schedules.list(this.date),
          window.api.todos.list(this.date),
          window.api.habits.list(this.date),
          window.api.priorities.list(this.date),
          window.api.stats.day(this.date)
        ])
        this.schedules = schedules
        this.todos = todos
        this.habits = habits
        this.priorities = priorities
        this.stats = stats
      } finally {
        this.loading = false
      }
    },

    /** 重新计算当日统计（任务或习惯变更后调用） */
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

    /* ------------------------------ 待办 ------------------------------ */
    async addTodo(input: TodoInput): Promise<void> {
      await window.api.todos.create(input)
      await this.load()
    },
    async updateTodo(id: number, patch: Partial<TodoInput>): Promise<void> {
      await window.api.todos.update(id, patch)
      await this.load()
    },
    async toggleTodo(id: number, done: boolean): Promise<void> {
      const updated = await window.api.todos.toggle(id, done)
      this.todos = this.todos.map((t) => (t.id === id ? updated : t))
      await this.refreshStats()
    },
    async removeTodo(id: number): Promise<void> {
      await window.api.todos.remove(id)
      await this.load()
    },

    /* ---------------------------- 重要事项 ---------------------------- */
    async addPriority(input: PriorityInput): Promise<void> {
      await window.api.priorities.create(input)
      await this.load()
    },
    async updatePriority(id: number, patch: Partial<PriorityInput>): Promise<void> {
      await window.api.priorities.update(id, patch)
      await this.load()
    },
    async togglePriority(id: number, done: boolean): Promise<void> {
      const updated = await window.api.priorities.toggle(id, done)
      this.priorities = this.priorities.map((p) => (p.id === id ? updated : p))
      await this.refreshStats()
    },
    async removePriority(id: number): Promise<void> {
      await window.api.priorities.remove(id)
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