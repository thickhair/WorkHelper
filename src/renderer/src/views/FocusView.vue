<script setup lang="ts">
/**
 * 专注空间：番茄式专注计时，记录每一段专注时长（focus_logs）。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { FocusOverview } from '@shared/types'
import { formatDate, formatMinutes, monthDayLabel } from '@shared/logic'
import { useToastStore } from '../stores/toast'
import Icon from '../components/Icon.vue'

/** 可选专注时长（分钟） */
const PRESETS = [15, 25, 45, 60]

const toast = useToastStore()
const today = formatDate(new Date())

const taskTitle = ref('')
const plannedMinutes = ref(25)
const status = ref<'idle' | 'running' | 'paused'>('idle')
const remaining = ref(plannedMinutes.value * 60)
const overview = ref<FocusOverview>({ todayMinutes: 0, recent: [] })

const totalSeconds = computed(() => plannedMinutes.value * 60)
const elapsedSeconds = computed(() => Math.max(0, totalSeconds.value - remaining.value))
const progress = computed(() =>
  totalSeconds.value === 0 ? 0 : Math.round((elapsedSeconds.value / totalSeconds.value) * 100)
)
const display = computed(() => {
  const m = Math.floor(remaining.value / 60)
  const s = remaining.value % 60
  return `${`${m}`.padStart(2, '0')}:${`${s}`.padStart(2, '0')}`
})

let timer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  timer = setInterval(tick, 1000)
  await loadOverview()
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

/** 切换预设时长（仅未开始时生效） */
watch(plannedMinutes, (value) => {
  if (status.value === 'idle') remaining.value = value * 60
})

function tick(): void {
  if (status.value !== 'running') return
  if (remaining.value > 0) remaining.value -= 1
  if (remaining.value === 0) {
    // 倒计时结束：自动记录本次专注
    status.value = 'paused'
    void finish()
  }
}

async function loadOverview(): Promise<void> {
  try {
    overview.value = await window.api.focus.overview(today, 20)
  } catch (err) {
    toast.error((err as Error).message)
  }
}

function start(): void {
  remaining.value = totalSeconds.value
  status.value = 'running'
}

function pause(): void {
  status.value = 'paused'
}

function resume(): void {
  status.value = 'running'
}

/** 放弃本次专注（不记录） */
function giveUp(): void {
  status.value = 'idle'
  remaining.value = totalSeconds.value
}

/** 完成并记录本次专注（至少 1 分钟） */
async function finish(): Promise<void> {
  if (elapsedSeconds.value <= 0) return
  const minutes = Math.max(1, Math.round(elapsedSeconds.value / 60))
  const title = taskTitle.value.trim() || '专注时段'
  try {
    await window.api.focus.create({ date: today, title, minutes })
    toast.success(`已记录专注 ${minutes} 分钟`)
    await loadOverview()
  } catch (err) {
    toast.error((err as Error).message)
  } finally {
    status.value = 'idle'
    remaining.value = totalSeconds.value
  }
}

/** 记录列表中的日期展示 */
function dateLabel(date: string): string {
  return date === today ? '今天' : monthDayLabel(date)
}
</script>

<template>
  <div class="page">
    <header class="page-head">
      <div class="head-left">
        <span class="head-icon"><Icon name="target" :size="17" /></span>
        <div class="head-text">
          <h1>专注空间</h1>
          <p>番茄式专注计时，记录每一段投入</p>
        </div>
      </div>
      <span class="date-chip"><Icon name="clock" :size="13" />今日已专注 {{ formatMinutes(overview.todayMinutes) }}</span>
    </header>

    <section class="focus-grid">
      <!-- 计时器 -->
      <div class="card timer-card">
        <div class="card-header">
          <span class="card-title"><Icon name="clock" :size="15" />专注计时</span>
          <span class="card-sub">{{ status === 'running' ? '专注进行中' : status === 'paused' ? '已暂停' : '准备开始' }}</span>
        </div>

        <input
          v-model="taskTitle"
          class="input title-input"
          placeholder="专注主题，例如：英语精读 / 剪辑练习"
          :disabled="status !== 'idle'"
        />

        <div class="preset-row">
          <button
            v-for="minute in PRESETS"
            :key="minute"
            class="preset-chip"
            :class="{ active: plannedMinutes === minute }"
            :disabled="status !== 'idle'"
            @click="plannedMinutes = minute"
          >
            {{ minute }} 分钟
          </button>
        </div>

        <div class="time-display" :class="{ running: status === 'running' }">{{ display }}</div>
        <div class="time-bar">
          <span :style="{ width: `${progress}%` }"></span>
        </div>
        <span class="time-hint">已完成 {{ progress }}%</span>

        <div class="timer-actions">
          <template v-if="status === 'idle'">
            <button class="btn btn-primary" @click="start">
              <Icon name="play" :size="12" />开始专注
            </button>
          </template>
          <template v-else>
            <button v-if="status === 'running'" class="btn btn-ghost btn-sm" @click="pause">
              暂停
            </button>
            <button v-else class="btn btn-primary btn-sm" @click="resume">
              <Icon name="play" :size="12" />继续
            </button>
            <button
              class="btn btn-primary btn-sm"
              :disabled="elapsedSeconds <= 0"
              @click="finish"
            >
              <Icon name="check" :size="12" />完成并记录
            </button>
            <button class="btn btn-plain btn-sm" @click="giveUp">放弃</button>
          </template>
        </div>
      </div>

      <div class="focus-col">
        <!-- 今日专注 -->
        <div class="card today-card">
          <div class="card-header">
            <span class="card-title"><Icon name="target" :size="15" />今日专注</span>
          </div>
          <span class="today-minutes">{{ formatMinutes(overview.todayMinutes) }}</span>
          <span class="today-desc">已完成 {{ overview.recent.filter((item) => item.date === today).length }} 段专注</span>
        </div>

        <!-- 最近记录 -->
        <div class="card">
          <div class="card-header">
            <span class="card-title"><Icon name="list" :size="15" />最近记录</span>
          </div>
          <div v-if="overview.recent.length === 0" class="empty">
            <Icon name="clock" :size="24" />
            <span>还没有专注记录，开始第一段专注吧</span>
          </div>
          <div v-else class="record-list">
            <div v-for="item in overview.recent" :key="item.id" class="record-row">
              <span class="record-date">{{ dateLabel(item.date) }}</span>
              <span class="record-title">{{ item.title }}</span>
              <span class="record-minutes">{{ item.minutes }} 分钟</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
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
}

.date-chip .icon {
  color: var(--green-600);
}

.focus-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.focus-col {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.timer-card {
  display: flex;
  flex-direction: column;
}

.title-input {
  height: 32px;
}

.preset-row {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.preset-chip {
  height: 28px;
  padding: 0 12px;
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-2);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.preset-chip:hover:not(:disabled) {
  border-color: var(--green-500);
  color: var(--green-700);
}

.preset-chip.active {
  background: var(--green-100);
  border-color: var(--green-400);
  color: var(--green-700);
}

.preset-chip:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.time-display {
  margin-top: 18px;
  text-align: center;
  font-size: 54px;
  font-weight: 800;
  letter-spacing: 2px;
  color: var(--text-1);
  font-variant-numeric: tabular-nums;
}

.time-display.running {
  color: var(--green-700);
}

.time-bar {
  margin-top: 12px;
  height: 8px;
  border-radius: 999px;
  background: var(--green-100);
  overflow: hidden;
}

.time-bar span {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--green-400), var(--green-600));
  transition: width 0.9s linear;
}

.time-hint {
  margin-top: 8px;
  text-align: center;
  font-size: 11.5px;
  color: var(--text-3);
}

.timer-actions {
  margin-top: 16px;
  display: flex;
  justify-content: center;
  gap: 10px;
}

.today-card {
  display: flex;
  flex-direction: column;
}

.today-minutes {
  font-size: 30px;
  font-weight: 800;
  color: var(--green-700);
}

.today-desc {
  margin-top: 4px;
  font-size: 11.5px;
  color: var(--text-3);
}

.record-list {
  display: flex;
  flex-direction: column;
}

.record-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 2px;
  border-bottom: 1px dashed var(--border);
}

.record-row:last-child {
  border-bottom: none;
}

.record-date {
  min-width: 52px;
  flex: none;
  font-size: 12px;
  font-weight: 700;
  color: var(--green-600);
  white-space: nowrap;
}

.record-title {
  flex: 1;
  min-width: 0;
  font-size: 12.8px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-minutes {
  flex: none;
  font-size: 12px;
  color: var(--text-2);
}

@media (max-width: 1160px) {
  .focus-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>