<script setup lang="ts">
/**
 * 每日计划页：问候卡片、四张统计卡片、今日日程、今日待办、
 * 习惯打卡、重要事项与下一个任务（参照设计稿布局）。
 */
import { computed, onMounted, ref } from 'vue'
import type { Habit, PriorityTask, Schedule, Todo } from '@shared/types'
import {
  addDays,
  formatDate,
  greetingByHour,
  monthDayLabel,
  parseDate,
  weekdayLabel
} from '@shared/logic'
import { usePlanStore } from '../stores/plan'
import { useToastStore } from '../stores/toast'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import FocusTimer from '../components/FocusTimer.vue'
import HabitEditDialog from '../components/HabitEditDialog.vue'
import Icon from '../components/Icon.vue'
import ModalDialog from '../components/ModalDialog.vue'
import ProgressRing from '../components/ProgressRing.vue'
import StatCard from '../components/StatCard.vue'
import TaskEditDialog, { TaskFormValue } from '../components/TaskEditDialog.vue'

const store = usePlanStore()
const toast = useToastStore()

const today = formatDate(new Date())

onMounted(() => {
  void store.load()
})

/* ------------------------------ 页头与日期 ------------------------------ */

const isToday = computed(() => store.date === today)
const greeting = computed(() => greetingByHour(new Date().getHours()))
const dateLabel = computed(
  () =>
    `${parseDate(store.date).getFullYear()}年${monthDayLabel(store.date)} ${weekdayLabel(store.date)}`
)
const todaySummary = computed(() => {
  const d = parseDate(store.date)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${weekdayLabel(store.date)}`
})

function shiftDay(delta: number): void {
  void store.load(addDays(store.date, delta))
}

function goToday(): void {
  void store.load(today)
}

/* ------------------------------ 统计卡片 ------------------------------ */

const statCards = computed(() => {
  const s = store.stats
  return [
    {
      icon: '🎯',
      label: '今日任务',
      value: `${s?.taskDone ?? 0}/${s?.taskTotal ?? 0}`,
      tag: '任务',
      tone: 'green' as const
    },
    {
      icon: '⏱️',
      label: '习惯打卡',
      value: `${s?.habitDone ?? 0}/${s?.habitTotal ?? 0}`,
      tag: '习惯',
      tone: 'yellow' as const
    },
    {
      icon: '📈',
      label: '今日进度',
      value: `${s?.progress ?? 0}%`,
      tag: '',
      tone: 'blue' as const
    },
    {
      icon: '🌟',
      label: '今日状态',
      value: s?.statusLabel ?? '等待计划',
      tag: '',
      tone: 'green' as const
    }
  ]
})

/* ------------------------------ 任务弹窗 ------------------------------ */

type TaskKind = 'schedule' | 'todo' | 'priority'

const taskDialog = ref<{
  visible: boolean
  kind: TaskKind
  editingId: number | null
  initial?: Partial<TaskFormValue>
}>({ visible: false, kind: 'schedule', editingId: null, initial: undefined })

function openCreate(kind: TaskKind): void {
  taskDialog.value = { visible: true, kind, editingId: null, initial: undefined }
}

function openEditSchedule(item: Schedule): void {
  taskDialog.value = {
    visible: true,
    kind: 'schedule',
    editingId: item.id,
    initial: { time: item.time, title: item.title, description: item.description }
  }
}

function openEditTodo(item: Todo): void {
  taskDialog.value = {
    visible: true,
    kind: 'todo',
    editingId: item.id,
    initial: { title: item.title, startTime: item.startTime, endTime: item.endTime }
  }
}

function openEditPriority(item: PriorityTask): void {
  taskDialog.value = {
    visible: true,
    kind: 'priority',
    editingId: item.id,
    initial: {
      title: item.title,
      startTime: item.startTime,
      endTime: item.endTime,
      priority: item.priority
    }
  }
}

async function saveTask(value: TaskFormValue): Promise<void> {
  const dialog = taskDialog.value
  try {
    if (dialog.kind === 'schedule') {
      const payload = {
        date: store.date,
        time: value.time,
        title: value.title,
        description: value.description
      }
      if (dialog.editingId) await store.updateSchedule(dialog.editingId, payload)
      else await store.addSchedule({ ...payload, done: false })
    } else if (dialog.kind === 'todo') {
      const payload = {
        date: store.date,
        title: value.title,
        startTime: value.startTime,
        endTime: value.endTime
      }
      if (dialog.editingId) await store.updateTodo(dialog.editingId, payload)
      else await store.addTodo({ ...payload, done: false })
    } else {
      const payload = {
        date: store.date,
        title: value.title,
        startTime: value.startTime,
        endTime: value.endTime,
        priority: value.priority
      }
      if (dialog.editingId) await store.updatePriority(dialog.editingId, payload)
      else await store.addPriority({ ...payload, done: false })
    }
    toast.success('已保存')
    taskDialog.value.visible = false
  } catch (err) {
    toast.error((err as Error).message)
  }
}

/* ------------------------------ 删除确认 ------------------------------ */

const confirmState = ref<{
  visible: boolean
  message: string
  action: (() => Promise<void>) | null
}>({ visible: false, message: '', action: null })

function askRemove(message: string, action: () => Promise<void>): void {
  confirmState.value = { visible: true, message, action }
}

async function runConfirm(): Promise<void> {
  const action = confirmState.value.action
  confirmState.value = { visible: false, message: '', action: null }
  if (!action) return
  try {
    await action()
    toast.success('已删除')
  } catch (err) {
    toast.error((err as Error).message)
  }
}

/* ------------------------------ 习惯管理 ------------------------------ */

const habitManagerVisible = ref(false)
const habitEditVisible = ref(false)
const editingHabit = ref<Habit | null>(null)

function openHabitEdit(habit: Habit | null): void {
  editingHabit.value = habit
  habitEditVisible.value = true
}

async function saveHabit(value: { name: string; icon: string; target: number }): Promise<void> {
  try {
    if (editingHabit.value) await store.updateHabit(editingHabit.value.id, value)
    else await store.addHabit(value)
    habitEditVisible.value = false
    toast.success('已保存')
  } catch (err) {
    toast.error((err as Error).message)
  }
}

async function checkInHabit(id: number, delta: number): Promise<void> {
  try {
    await store.checkInHabit(id, delta)
  } catch (err) {
    toast.error((err as Error).message)
  }
}

/* ------------------------------ 专注计时 ------------------------------ */

const focusTask = ref<Schedule | null>(null)

function startFocus(): void {
  if (!store.nextTask) {
    toast.push('今日日程已全部完成，休息一下吧', 'info')
    return
  }
  focusTask.value = store.nextTask
}

async function onFocusFinish(minutes: number): Promise<void> {
  const task = focusTask.value
  focusTask.value = null
  if (!task) return
  try {
    await window.api.focus.create({ date: store.date, title: task.title, minutes })
    await store.toggleSchedule(task.id, true)
    toast.success(`已完成「${task.title}」，专注 ${minutes} 分钟`)
  } catch (err) {
    toast.error((err as Error).message)
  }
}

/* ------------------------------ 展示工具 ------------------------------ */

const PRIORITY_LABEL: Record<string, string> = { high: '高', medium: '中', low: '低' }

function timeRange(start: string, end: string): string {
  if (start && end) return `${start} - ${end}`
  return start || end || ''
}
</script>

<template>
  <div class="page">
    <!-- 页头 -->
    <header class="page-head">
      <div class="head-left">
        <span class="head-icon"><Icon name="calendar" :size="17" /></span>
        <div class="head-text">
          <h1>每日计划</h1>
          <p>合理规划每一天，让目标更进一步</p>
        </div>
      </div>
      <div class="date-nav">
        <span class="date-chip">
          <Icon name="calendar" :size="13" />{{ dateLabel }}
        </span>
        <button class="icon-btn" title="前一天" @click="shiftDay(-1)">
          <Icon name="chevronLeft" :size="14" />
        </button>
        <button class="icon-btn" title="后一天" @click="shiftDay(1)">
          <Icon name="chevronRight" :size="14" />
        </button>
        <button v-if="!isToday" class="btn btn-ghost btn-sm" @click="goToday">回到今天</button>
      </div>
    </header>

    <!-- 问候卡片 -->
    <section class="greeting-card">
      <div class="greeting-text">
        <h2>{{ greeting }}，{{ todaySummary }}！</h2>
        <p>专注当下，做好今天的每一件事。</p>
        <span class="greeting-quote">
          <Icon name="sun" :size="13" />
          {{ isToday ? '今天也要好心情哦' : '回顾这一天，看看完成了什么' }}
        </span>
      </div>
      <div class="greeting-art">
        <svg viewBox="0 0 150 100" width="150" height="100">
          <circle cx="96" cy="34" r="30" fill="#FBE8B4" opacity="0.75" />
          <path d="M60 66c0-16-9-27-25-31 2 18 11 28 25 31z" fill="#8FC79D" />
          <path d="M62 66c0-18 9-30 27-34-2 20-12 31-27 34z" fill="#A9D8B4" />
          <path d="M61 66c0-11-4-22-10-29 1 13 4 23 10 29z" fill="#7BBB8C" />
          <rect x="44" y="62" width="40" height="9" rx="4" fill="#D89A6B" />
          <path d="M47 71h34l-3 20a5 5 0 0 1-5 4H55a5 5 0 0 1-5-4z" fill="#C98A5B" />
          <path d="M52 79h24" stroke="#B87A4C" stroke-width="2" stroke-linecap="round" />
        </svg>
      </div>
    </section>

    <!-- 统计卡片 -->
    <section class="stat-row">
      <StatCard
        v-for="card in statCards"
        :key="card.label"
        :icon="card.icon"
        :label="card.label"
        :value="card.value"
        :tag="card.tag"
        :tone="card.tone"
      />
    </section>

    <!-- 主内容双栏 -->
    <section class="plan-grid">
      <!-- 左栏 -->
      <div class="plan-col">
        <!-- 今日日程 -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">
              <Icon name="clock" :size="15" />今日日程
            </span>
            <span class="card-sub">{{ store.schedules.filter((s) => !s.done).length }} 项待完成</span>
            <button class="card-action" @click="openCreate('schedule')">
              <Icon name="plus" :size="12" />添加日程
            </button>
          </div>

          <div v-if="store.schedules.length === 0" class="empty">
            <Icon name="clock" :size="26" />
            <span>还没有日程安排，点击「添加日程」开始规划</span>
          </div>

          <div v-else class="row-list">
            <div
              v-for="item in store.schedules"
              :key="item.id"
              class="row"
              :class="{ done: item.done }"
            >
              <span class="row-time">{{ item.time }}</span>
              <div class="row-main">
                <span class="row-title">{{ item.title }}</span>
                <span v-if="item.description" class="row-desc">{{ item.description }}</span>
              </div>
              <div class="row-actions">
                <button class="icon-btn" title="编辑" @click="openEditSchedule(item)">
                  <Icon name="edit" :size="13" />
                </button>
                <button
                  class="icon-btn danger"
                  title="删除"
                  @click="
                    askRemove(`确定删除日程「${item.title}」吗？`, () =>
                      store.removeSchedule(item.id)
                    )
                  "
                >
                  <Icon name="trash" :size="13" />
                </button>
              </div>
              <button
                class="round-check"
                :class="{ checked: item.done }"
                :title="item.done ? '标记未完成' : '标记完成'"
                @click="store.toggleSchedule(item.id, !item.done)"
              >
                <Icon name="check" :size="11" />
              </button>
            </div>
          </div>
        </div>

        <!-- 习惯打卡 -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">
              <Icon name="fire" :size="15" />习惯打卡
            </span>
            <span class="card-sub">点击圆环打卡</span>
            <button class="card-action" @click="habitManagerVisible = true">
              <Icon name="settings" :size="12" />管理习惯
            </button>
          </div>

          <div v-if="store.habits.length === 0" class="empty">
            <Icon name="fire" :size="26" />
            <span>还没有习惯，点击「管理习惯」添加</span>
          </div>

          <div v-else class="habit-grid">
            <div v-for="habit in store.habits" :key="habit.id" class="habit-item">
              <ProgressRing
                :icon="habit.icon"
                :count="habit.count"
                :target="habit.target"
                @check="checkInHabit(habit.id, 1)"
              />
              <span class="habit-count">{{ habit.count }}/{{ habit.target }}</span>
              <span class="habit-name">{{ habit.name }}</span>
              <button
                v-if="habit.count > 0"
                class="habit-undo"
                title="撤销一次打卡"
                @click="checkInHabit(habit.id, -1)"
              >
                −
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 右栏 -->
      <div class="plan-col">
        <!-- 今日待办 -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">
              <Icon name="check" :size="15" />今日待办
            </span>
            <span class="card-sub">· {{ store.todos.length }} 项</span>
            <button class="card-action" @click="openCreate('todo')">
              <Icon name="plus" :size="12" />添加待办
            </button>
          </div>

          <div v-if="store.todos.length === 0" class="empty">
            <Icon name="list" :size="26" />
            <span>暂无待办事项</span>
          </div>

          <div v-else class="row-list">
            <div v-for="item in store.todos" :key="item.id" class="row compact">
              <button
                class="round-check"
                :class="{ checked: item.done }"
                @click="store.toggleTodo(item.id, !item.done)"
              >
                <Icon name="check" :size="11" />
              </button>
              <div class="row-main">
                <span class="row-title" :class="{ strike: item.done }">{{ item.title }}</span>
                <span v-if="timeRange(item.startTime, item.endTime)" class="row-desc">
                  {{ timeRange(item.startTime, item.endTime) }}
                </span>
              </div>
              <div class="row-actions">
                <button class="icon-btn" title="编辑" @click="openEditTodo(item)">
                  <Icon name="edit" :size="13" />
                </button>
                <button
                  class="icon-btn danger"
                  title="删除"
                  @click="
                    askRemove(`确定删除待办「${item.title}」吗？`, () => store.removeTodo(item.id))
                  "
                >
                  <Icon name="trash" :size="13" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 重要事项 -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">
              <Icon name="star" :size="15" />重要事项
            </span>
            <span class="card-sub">· {{ store.priorities.length }} 项</span>
            <button class="card-action" @click="openCreate('priority')">
              <Icon name="plus" :size="12" />添加
            </button>
          </div>

          <div v-if="store.priorities.length === 0" class="empty">
            <Icon name="star" :size="26" />
            <span>暂无重要事项</span>
          </div>

          <div v-else class="row-list">
            <div v-for="item in store.priorities" :key="item.id" class="row compact">
              <span class="priority-dot" :class="item.priority" :title="`${PRIORITY_LABEL[item.priority]}优先级`"></span>
              <div class="row-main">
                <span class="row-title" :class="{ strike: item.done }">{{ item.title }}</span>
                <span v-if="timeRange(item.startTime, item.endTime)" class="row-desc">
                  {{ timeRange(item.startTime, item.endTime) }}
                </span>
              </div>
              <div class="row-actions">
                <button class="icon-btn" title="编辑" @click="openEditPriority(item)">
                  <Icon name="edit" :size="13" />
                </button>
                <button
                  class="icon-btn danger"
                  title="删除"
                  @click="
                    askRemove(`确定删除重要事项「${item.title}」吗？`, () =>
                      store.removePriority(item.id)
                    )
                  "
                >
                  <Icon name="trash" :size="13" />
                </button>
              </div>
              <button
                class="round-check"
                :class="{ checked: item.done }"
                @click="store.togglePriority(item.id, !item.done)"
              >
                <Icon name="check" :size="11" />
              </button>
            </div>
          </div>
        </div>

        <!-- 下一个任务 -->
        <div class="card next-card">
          <div class="card-header">
            <span class="card-title">
              <Icon name="target" :size="15" />下一个任务
            </span>
            <RouterLink class="card-action" to="/plan">
              <Icon name="arrowRight" :size="12" />
            </RouterLink>
          </div>

          <div v-if="store.nextTask" class="next-body">
            <span class="next-icon">🎯</span>
            <div class="next-info">
              <span class="next-title">{{ store.nextTask.title }}</span>
              <span class="next-desc">
                {{ store.nextTask.description || '按计划推进，保持节奏' }}
              </span>
              <span class="next-time">
                <Icon name="clock" :size="11" />{{ store.nextTask.time }} 开始
              </span>
            </div>
            <button class="btn btn-primary" @click="startFocus">
              <Icon name="play" :size="12" />开始
            </button>
          </div>

          <div v-else class="empty">
            <Icon name="check" :size="26" />
            <span>今日日程已全部完成，给自己点个赞</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 弹窗：任务编辑 -->
    <TaskEditDialog
      :visible="taskDialog.visible"
      :kind="taskDialog.kind"
      :initial="taskDialog.initial"
      :is-edit="taskDialog.editingId !== null"
      @close="taskDialog.visible = false"
      @save="saveTask"
    />

    <!-- 弹窗：习惯管理 -->
    <ModalDialog
      :visible="habitManagerVisible"
      title="管理习惯"
      width="420px"
      @close="habitManagerVisible = false"
    >
      <div class="habit-manage-list">
        <div v-for="habit in store.habits" :key="habit.id" class="habit-manage-row">
          <span class="hm-icon">{{ habit.icon }}</span>
          <span class="hm-name">{{ habit.name }}</span>
          <span class="tag tag-plain">目标 {{ habit.target }} 次/天</span>
          <button class="icon-btn" title="编辑" @click="openHabitEdit(habit)">
            <Icon name="edit" :size="13" />
          </button>
          <button
            class="icon-btn danger"
            title="删除"
            @click="
              askRemove(`确定删除习惯「${habit.name}」吗？历史打卡记录将一并删除。`, () =>
                store.removeHabit(habit.id)
              )
            "
          >
            <Icon name="trash" :size="13" />
          </button>
        </div>
        <div v-if="store.habits.length === 0" class="empty">
          <span>暂无习惯</span>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-ghost" @click="openHabitEdit(null)">
          <Icon name="plus" :size="13" />新增习惯
        </button>
        <button class="btn btn-primary" @click="habitManagerVisible = false">完成</button>
      </template>
    </ModalDialog>

    <!-- 弹窗：习惯编辑 -->
    <HabitEditDialog
      :visible="habitEditVisible"
      :habit="editingHabit"
      @close="habitEditVisible = false"
      @save="saveHabit"
    />

    <!-- 弹窗：删除确认 -->
    <ConfirmDialog
      :visible="confirmState.visible"
      :message="confirmState.message"
      @close="confirmState.visible = false"
      @confirm="runConfirm"
    />

    <!-- 专注计时器 -->
    <FocusTimer
      v-if="focusTask"
      :title="focusTask.title"
      :planned-minutes="30"
      @finish="onFocusFinish"
      @cancel="focusTask = null"
    />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ------------------------------- 页头 ------------------------------- */
.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.head-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.head-icon {
  width: 34px;
  height: 34px;
  border-radius: 11px;
  background: linear-gradient(135deg, var(--green-500), var(--green-600));
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 10px var(--brand-shadow);
}

.head-text h1 {
  font-size: 16px;
  font-weight: 800;
}

.head-text p {
  font-size: 11.5px;
  color: var(--text-3);
  margin-top: 1px;
}

.date-nav {
  display: flex;
  align-items: center;
  gap: 4px;
}

.date-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  background: var(--surface);
  box-shadow: var(--shadow-card);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-1);
  margin-right: 4px;
}

.date-chip .icon {
  color: var(--green-600);
}

/* ----------------------------- 问候卡片 ----------------------------- */
.greeting-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-radius: var(--radius-lg);
  background: linear-gradient(120deg, #e7f5ea 0%, #f6fbf7 62%, #fdf6e3 100%);
  border: 1px solid var(--brand-ring);
  overflow: hidden;
}

.greeting-text h2 {
  font-size: 17px;
  font-weight: 800;
  color: var(--green-800);
}

.greeting-text p {
  margin-top: 4px;
  font-size: 12.5px;
  color: var(--text-2);
}

.greeting-quote {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 10px;
  font-size: 11.5px;
  color: var(--green-700);
  background: rgba(255, 255, 255, 0.75);
  border-radius: 999px;
  padding: 3px 10px;
}

.greeting-art {
  flex: none;
  margin: -10px 6px -18px 0;
  opacity: 0.95;
}

/* ----------------------------- 统计卡片 ----------------------------- */
.stat-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

/* ----------------------------- 主内容区 ----------------------------- */
.plan-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.04fr) minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.plan-col {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

/* ------------------------------- 列表行 ------------------------------- */
.row-list {
  display: flex;
  flex-direction: column;
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 2px;
  border-bottom: 1px dashed var(--border);
}

.row:last-child {
  border-bottom: none;
}

.row.compact {
  padding: 6px 2px;
}

.row-time {
  width: 44px;
  flex: none;
  font-size: 12.5px;
  font-weight: 800;
  color: var(--green-600);
  font-variant-numeric: tabular-nums;
}

.row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.row-title {
  font-size: 12.8px;
  font-weight: 700;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-desc {
  font-size: 11.5px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row.done .row-title {
  color: var(--text-3);
}

.row-title.strike {
  text-decoration: line-through;
  color: var(--text-3);
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}

.row:hover .row-actions {
  opacity: 1;
}

.priority-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex: none;
}

.priority-dot.high {
  background: var(--red);
  box-shadow: 0 0 0 3px rgba(232, 106, 94, 0.16);
}

.priority-dot.medium {
  background: var(--yellow);
  box-shadow: 0 0 0 3px rgba(245, 185, 66, 0.18);
}

.priority-dot.low {
  background: var(--green-500);
  box-shadow: 0 0 0 3px var(--brand-ring);
}

/* ------------------------------- 习惯区 ------------------------------- */
.habit-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}

.habit-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 6px 2px;
  border-radius: 12px;
  transition: background 0.15s;
}

.habit-item:hover {
  background: var(--green-50);
}

.habit-count {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--green-700);
}

.habit-name {
  font-size: 11.5px;
  color: var(--text-2);
  white-space: nowrap;
}

.habit-undo {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: none;
  background: var(--surface);
  color: var(--text-3);
  box-shadow: 0 1px 4px rgba(31, 84, 49, 0.2);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
}

.habit-item:hover .habit-undo {
  opacity: 1;
}

.habit-undo:hover {
  color: var(--red);
}

/* ----------------------------- 下一个任务 ----------------------------- */
.next-body {
  display: flex;
  align-items: center;
  gap: 12px;
}

.next-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--green-100);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 19px;
  flex: none;
}

.next-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.next-title {
  font-size: 13px;
  font-weight: 700;
}

.next-desc {
  font-size: 11.5px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.next-time {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--green-700);
}

/* ----------------------------- 习惯管理弹窗 ----------------------------- */
.habit-manage-list {
  display: flex;
  flex-direction: column;
  max-height: 320px;
  overflow: auto;
}

.habit-manage-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 2px;
  border-bottom: 1px dashed var(--border);
}

.habit-manage-row:last-child {
  border-bottom: none;
}

.hm-icon {
  font-size: 16px;
}

.hm-name {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
}

/* ------------------------------- 响应式 ------------------------------- */
@media (max-width: 1240px) {
  .stat-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 1160px) {
  .plan-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>