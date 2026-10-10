<script setup lang="ts">
/**
 * 首页仪表盘：今日概览、今日日程管理（增删改 / 置顶 / 拖拽排序 / 颜色标记）、
 * 习惯与心情打卡与快捷入口。
 * 每日计划页已整合进本页，统计看板迁移至日历页。
 */
import { computed, onMounted, ref } from 'vue'
import type { AssetsSummary, Birthday, MoodRecord, Schedule } from '@shared/types'
import { formatMoney } from '@shared/assets'
import { birthdayDateLabel, daysUntilBirthday } from '@shared/calendar'
import { featureByRoute } from '@shared/features'
import {
  addDays,
  formatDate,
  greetingByHour,
  monthDayLabel,
  moveSchedule,
  sortDaySchedules,
  weekdayLabel
} from '@shared/logic'
import { moodEmoji, moodLabel, moodStreak } from '@shared/moods'
import { useAppStore } from '../stores/app'
import { usePlanStore } from '../stores/plan'
import { useSidebarStore } from '../stores/sidebar'
import { useToastStore } from '../stores/toast'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import HabitPanel from '../components/HabitPanel.vue'
import Icon from '../components/Icon.vue'
import MoodPicker from '../components/MoodPicker.vue'
import ScheduleEditDialog, { ScheduleFormValue } from '../components/ScheduleEditDialog.vue'
import StatCard from '../components/StatCard.vue'

const appStore = useAppStore()
const planStore = usePlanStore()
const sidebarStore = useSidebarStore()
const toast = useToastStore()

const today = formatDate(new Date())
const birthdays = ref<Birthday[]>([])
/** 近一年心情记录（用于连续打卡统计） */
const moodRecords = ref<MoodRecord[]>([])
const todayMood = ref<number | null>(null)
/** 资产概览（金额默认隐藏，点击眼睛图标切换） */
const assetsSummary = ref<AssetsSummary | null>(null)
const showAssets = ref(false)

onMounted(async () => {
  try {
    await planStore.load(today)
    const [birthdayData, moodData] = await Promise.all([
      window.api.birthdays.list(),
      window.api.moods.range(addDays(today, -366), today)
    ])
    birthdays.value = birthdayData
    moodRecords.value = moodData
    todayMood.value = moodData.find((item) => item.date === today)?.mood ?? null
    if (sidebarStore.isEnabled('assets')) {
      assetsSummary.value = await window.api.assets.summary()
    }
  } catch (err) {
    toast.error((err as Error).message)
  }
})

/* ------------------------------ 心情打卡 ------------------------------ */

/** 一键记录今日心情（再次点击当前心情 = 取消记录） */
async function setMood(value: number | null): Promise<void> {
  try {
    await window.api.moods.set(today, value)
    todayMood.value = value
    if (value === null) toast.push('已取消今天的心情打卡', 'info')
    else toast.success(`打卡成功：今天的心情是「${moodLabel(value)}」`)
  } catch (err) {
    toast.error((err as Error).message)
  }
}

/** 连续打卡天数：近一年记录 + 今日实时状态（今天已记录才计入） */
const moodStreakDays = computed(() => {
  const dates = moodRecords.value.map((item) => item.date).filter((date) => date !== today)
  if (todayMood.value !== null) dates.push(today)
  return moodStreak(dates, today)
})

/* ------------------------------ 页头与统计 ------------------------------ */

const greeting = computed(() => greetingByHour(new Date().getHours()))
const dateText = computed(() => `${monthDayLabel(today)} ${weekdayLabel(today)}`)

const statCards = computed(() => {
  const s = planStore.stats
  return [
    {
      icon: '🎯',
      label: '今日日程',
      value: `${s?.taskDone ?? 0}/${s?.taskTotal ?? 0}`,
      tag: '日程',
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

/* ------------------------------ 今日日程管理 ------------------------------ */

const daySchedules = computed(() => sortDaySchedules(planStore.schedules))
const pendingCount = computed(() => daySchedules.value.filter((item) => !item.done).length)

async function toggleTask(item: Schedule): Promise<void> {
  try {
    await planStore.toggleSchedule(item.id, !item.done)
  } catch (err) {
    toast.error((err as Error).message)
  }
}

function removeTask(item: Schedule): void {
  askRemove(`确定删除日程「${item.title}」吗？`, () => planStore.removeSchedule(item.id))
}

/* ------------------------------ 日程弹窗 ------------------------------ */

const dialog = ref<{
  visible: boolean
  editingId: number | null
  initial?: Partial<ScheduleFormValue>
}>({ visible: false, editingId: null, initial: undefined })

function openCreate(): void {
  dialog.value = { visible: true, editingId: null, initial: undefined }
}

function openEdit(item: Schedule): void {
  dialog.value = {
    visible: true,
    editingId: item.id,
    initial: {
      time: item.time,
      title: item.title,
      description: item.description,
      color: item.color
    }
  }
}

async function saveTask(value: ScheduleFormValue): Promise<void> {
  const editingId = dialog.value.editingId
  try {
    const payload = {
      date: today,
      time: value.time,
      title: value.title,
      description: value.description,
      color: value.color
    }
    if (editingId) await planStore.updateSchedule(editingId, payload)
    else await planStore.addSchedule({ ...payload, done: false })
    toast.success('已保存')
    dialog.value.visible = false
  } catch (err) {
    toast.error((err as Error).message)
  }
}

/* ------------------------------ 置顶与拖拽排序 ------------------------------ */

/** 切换日程「固定到顶部」（置顶项在未完成组最前） */
async function togglePin(item: Schedule): Promise<void> {
  try {
    await planStore.updateSchedule(item.id, { pinned: !item.pinned })
  } catch (err) {
    toast.error((err as Error).message)
  }
}

/** 拖拽状态：仅「未设置时间」的日程可拖动（dragId 为拖拽源，dropTarget 为插入目标与前后位置） */
const dragId = ref(0)
const dropTarget = ref<{ id: number; after: boolean } | null>(null)

/** 仅未设置时间的日程可作为拖拽源（设置时间的条目按时间自动排序） */
function canDrag(item: Schedule): boolean {
  return !item.time
}

/** 仅未设置时间的日程可作为落点 */
function canDropOn(item: Schedule): boolean {
  return !item.time
}

function dragClass(id: number): Record<string, boolean> {
  return {
    dragging: dragId.value === id,
    'drop-before': dropTarget.value?.id === id && dropTarget.value.after === false,
    'drop-after': dropTarget.value?.id === id && dropTarget.value.after === true
  }
}

function onDragStart(item: Schedule, event: DragEvent): void {
  dragId.value = item.id
  dropTarget.value = null
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', String(item.id))
    event.dataTransfer.effectAllowed = 'move'
  }
}

function onDragOver(item: Schedule, event: DragEvent): void {
  if (!dragId.value || !canDropOn(item) || item.id === dragId.value) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  const el = event.currentTarget as HTMLElement
  const after = event.offsetY > el.offsetHeight / 2
  if (dropTarget.value?.id === item.id && dropTarget.value.after === after) return
  dropTarget.value = { id: item.id, after }
}

async function onDrop(item: Schedule): Promise<void> {
  const from = dragId.value
  const target = dropTarget.value
  cleanupDrag()
  if (!from || !target || target.id !== item.id) return
  // 按可视顺序重编号「未设置时间」的日程（设置时间的条目按时间排序，不参与手动顺序）
  const nextList = moveSchedule(daySchedules.value, from, target.id, target.after)
  const ids = nextList.filter((one) => !one.time).map((one) => one.id)
  try {
    await planStore.reorderSchedules(ids)
  } catch (err) {
    toast.error((err as Error).message)
  }
}

function cleanupDrag(): void {
  dragId.value = 0
  dropTarget.value = null
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

/* ------------------------------ 快捷入口 ------------------------------ */

const QUICK_LINKS = [
  { path: '/calendar', title: '日历', desc: '看板与心情回看', icon: 'calendar' },
  { path: '/assets', title: '资产', desc: '账户与攒钱进度', icon: 'wallet' }
]

/** 快捷入口展示侧边栏中的功能（固定功能始终包含） */
const quickLinks = computed(() =>
  QUICK_LINKS.filter((link) => {
    const feature = featureByRoute(link.path)
    return feature ? sidebarStore.isEnabled(feature.id) : true
  })
)

/** 「资产」功能是否已添加（决定资产概览卡片显示） */
const assetsEnabled = computed(() => sidebarStore.isEnabled('assets'))

/** 资产金额展示（默认隐藏为 ****） */
function assetText(value: number): string {
  return showAssets.value ? `¥${formatMoney(value)}` : '¥****'
}

/* ------------------------------ 生日提醒 ------------------------------ */

/** 未来 60 天内即将到来的生日（含今天），按临近程度排序 */
const upcomingBirthdays = computed(() =>
  birthdays.value
    .map((item) => ({ birthday: item, daysUntil: daysUntilBirthday(item, today) }))
    .filter((item) => item.daysUntil >= 0 && item.daysUntil <= 60)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 4)
)
</script>

<template>
  <div class="page">
    <header class="page-head">
      <div class="head-left">
        <span class="head-icon"><Icon name="home" :size="17" /></span>
        <div class="head-text">
          <h1>首页</h1>
          <p>今天也要元气满满，按计划前进</p>
        </div>
      </div>
      <RouterLink class="date-chip" to="/calendar" title="打开日历">
        <Icon name="calendar" :size="13" />{{ dateText }}<Icon name="chevronRight" :size="12" />
      </RouterLink>
    </header>

    <!-- 欢迎卡片 -->
    <section class="hero-card">
      <div class="hero-left">
        <h2>{{ greeting }}，{{ appStore.userName }}！</h2>
        <p class="hero-sub">今天是 {{ dateText }}，你已完成今日计划的 {{ planStore.stats?.progress ?? 0 }}%</p>
        <div class="hero-progress">
          <span class="hero-bar"><i :style="{ width: `${planStore.stats?.progress ?? 0}%` }"></i></span>
          <span class="hero-progress-text">{{ planStore.stats?.statusLabel ?? '等待计划' }}</span>
        </div>
      </div>
      <div class="hero-links">
        <RouterLink v-for="link in quickLinks" :key="link.path" :to="link.path" class="quick-link">
          <span class="quick-icon"><Icon :name="link.icon" :size="15" /></span>
          <span class="quick-text">
            <span class="quick-title">{{ link.title }}</span>
            <span class="quick-desc">{{ link.desc }}</span>
          </span>
          <Icon name="arrowRight" :size="13" />
        </RouterLink>
      </div>
    </section>

    <!-- 统计卡片（点击跳转到日历查看统计看板） -->
    <section class="stat-row">
      <RouterLink
        v-for="card in statCards"
        :key="card.label"
        class="stat-link"
        to="/calendar"
        :title="`查看日历中的${card.label}详情`"
      >
        <StatCard
          :icon="card.icon"
          :label="card.label"
          :value="card.value"
          :tag="card.tag"
          :tone="card.tone"
        />
      </RouterLink>
    </section>

    <!-- 双栏 -->
    <section class="home-grid">
      <div class="home-col">
        <!-- 今日日程：清单 + 增删改 / 置顶 / 拖拽排序 -->
        <div class="card">
          <div class="card-header">
            <span class="card-title"><Icon name="clock" :size="15" />今日日程</span>
            <span class="card-sub">{{ pendingCount }} 项待完成 · 共 {{ daySchedules.length }} 项</span>
            <button class="card-action" @click="openCreate">
              <Icon name="plus" :size="12" />添加
            </button>
          </div>

          <div v-if="daySchedules.length === 0" class="empty">
            <Icon name="list" :size="26" />
            <span>今天还没有日程，点击右上角「添加」新建日程</span>
          </div>

          <div v-else class="row-list">
            <div
              v-for="item in daySchedules"
              :key="item.id"
              class="row task-row"
              :class="[{ done: item.done }, dragClass(item.id)]"
              :style="item.color ? { boxShadow: `inset 3px 0 0 ${item.color}` } : undefined"
              draggable="false"
              @dragover="onDragOver(item, $event)"
              @drop.prevent="onDrop(item)"
            >
              <button
                v-if="canDrag(item)"
                class="drag-grip"
                draggable="true"
                title="拖动调整顺序"
                :aria-label="`拖动调整「${item.title}」的顺序`"
                @dragstart="onDragStart(item, $event)"
                @dragend="cleanupDrag"
                @click.prevent.stop
              >
                <Icon name="grip" :size="12" />
              </button>
              <button
                class="round-check"
                :class="{ checked: item.done }"
                :title="item.done ? '标记未完成' : '标记完成'"
                @click="toggleTask(item)"
              >
                <Icon name="check" :size="11" />
              </button>
              <span class="row-time" :class="{ 'all-day': !item.time }">
                {{ item.time || '全天' }}
              </span>
              <div class="row-main">
                <span class="row-title">{{ item.title }}</span>
                <span v-if="item.description" class="row-desc">{{ item.description }}</span>
              </div>
              <button
                class="icon-btn pin-btn"
                :class="{ active: item.pinned }"
                :title="item.pinned ? '取消固定' : '固定到顶部'"
                @click="togglePin(item)"
              >
                <Icon name="pin" :size="13" />
              </button>
              <div class="row-actions">
                <button class="icon-btn" title="编辑" @click="openEdit(item)">
                  <Icon name="edit" :size="13" />
                </button>
                <button class="icon-btn danger" title="删除" @click="removeTask(item)">
                  <Icon name="trash" :size="13" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="home-col">
        <!-- 习惯打卡（显著位置：点击圆环快速打卡） -->
        <HabitPanel />

        <!-- 心情打卡（紧凑版：悬停预览 + 点击打卡，标题旁心情图标随打卡变化） -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">
              <Icon name="sun" :size="15" />心情打卡
              <Transition name="mood-swap" mode="out-in">
                <span v-if="todayMood !== null" :key="todayMood" class="mood-live">
                  {{ moodEmoji(todayMood) }}
                </span>
              </Transition>
            </span>
            <span class="card-sub">
              {{ todayMood === null ? '今天还没打卡' : `已打卡 · 连续打卡 ${moodStreakDays} 天` }}
            </span>
          </div>
          <MoodPicker :model-value="todayMood" @update:model-value="setMood" />
        </div>

        <!-- 资产概览（已添加「资产」功能时显示，金额默认隐藏） -->
        <div v-if="assetsEnabled" class="card assets-card">
          <div class="card-header">
            <span class="card-title"><Icon name="wallet" :size="15" />资产概览</span>
            <span class="card-sub">{{ assetsSummary?.accountCount ?? 0 }} 个账户</span>
            <button
              class="eye-toggle"
              :title="showAssets ? '隐藏金额' : '显示金额'"
              @click="showAssets = !showAssets"
            >
              <Icon :name="showAssets ? 'eye' : 'eyeOff'" :size="13" />
            </button>
            <RouterLink class="card-action" to="/assets">
              打开资产<Icon name="chevronRight" :size="12" />
            </RouterLink>
          </div>
          <div class="assets-total">
            <span class="assets-total-label">总资产</span>
            <span class="assets-total-value">{{ assetText(assetsSummary?.total ?? 0) }}</span>
          </div>
          <div class="assets-month">
            <span class="assets-month-item income">
              本月收入 +{{ assetText(assetsSummary?.monthIncome ?? 0) }}
            </span>
            <span class="assets-month-item expense">
              本月支出 -{{ assetText(assetsSummary?.monthExpense ?? 0) }}
            </span>
          </div>
          <p class="card-tip">金额为手动记账口径，点击眼睛图标可显示或隐藏</p>
        </div>

        <!-- 生日提醒（未来 60 天内有生日时显示） -->
        <div v-if="upcomingBirthdays.length > 0" class="card">
          <div class="card-header">
            <span class="card-title"><Icon name="gift" :size="15" />生日提醒</span>
            <span class="card-sub">未来 60 天</span>
            <RouterLink class="card-action" to="/calendar">
              打开日历<Icon name="chevronRight" :size="12" />
            </RouterLink>
          </div>
          <div class="row-list">
            <div v-for="item in upcomingBirthdays" :key="item.birthday.id" class="row compact">
              <span class="birth-badge"><Icon name="gift" :size="13" /></span>
              <div class="row-main">
                <span class="row-title">{{ item.birthday.name }}</span>
                <span class="row-desc">
                  {{ birthdayDateLabel(item.birthday) }}（{{ item.birthday.calendar === 'lunar' ? '农历' : '公历' }}）
                </span>
              </div>
              <span class="until-chip" :class="{ soon: item.daysUntil <= item.birthday.remindDays }">
                {{ item.daysUntil === 0 ? '今天' : `${item.daysUntil} 天后` }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 弹窗：日程编辑 / 删除确认 -->
    <ScheduleEditDialog
      :visible="dialog.visible"
      :initial="dialog.initial"
      :is-edit="dialog.editingId !== null"
      @close="dialog.visible = false"
      @save="saveTask"
    />
    <ConfirmDialog
      :visible="confirmState.visible"
      :message="confirmState.message"
      @close="confirmState.visible = false"
      @confirm="runConfirm"
    />
  </div>
</template>

<style scoped>
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
  text-decoration: none;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.date-chip:hover {
  background: var(--green-100);
  color: var(--green-700);
}

.date-chip .icon {
  color: var(--green-600);
}

/* --------------------------- 心情打卡与资产提示 --------------------------- */
.card-tip {
  margin-top: 10px;
  font-size: 11px;
  color: var(--text-3);
}

/* 标题旁的心情图标：打卡后随心情切换（弹出 + 微旋转动画） */
.mood-live {
  display: inline-block;
  font-size: 16px;
  line-height: 1;
}

.mood-swap-enter-active {
  animation: mood-live-pop 0.34s var(--ease-std);
}

.mood-swap-leave-active {
  transition: opacity 0.14s, transform 0.14s;
}

.mood-swap-enter-from {
  opacity: 0;
  transform: scale(0.4) rotate(-16deg);
}

.mood-swap-leave-to {
  opacity: 0;
  transform: scale(1.3) rotate(12deg);
}

@keyframes mood-live-pop {
  0% {
    transform: scale(0.42) rotate(-14deg);
  }
  60% {
    transform: scale(1.28) rotate(6deg);
  }
  100% {
    transform: scale(1) rotate(0deg);
  }
}

/* ------------------------------ 资产概览 ------------------------------ */
.assets-card .card-action {
  margin-left: 0;
}

.eye-toggle {
  margin-left: auto;
  width: 24px;
  height: 24px;
  flex: none;
  border: none;
  border-radius: 8px;
  background: var(--plain-bg);
  color: var(--text-2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.eye-toggle:hover {
  background: var(--green-100);
  color: var(--green-700);
}

.assets-total {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-top: 2px;
}

.assets-total-label {
  font-size: 12px;
  color: var(--text-3);
  font-weight: 600;
}

.assets-total-value {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 0.3px;
  color: var(--text-1);
}

.assets-month {
  display: flex;
  gap: 12px;
  margin-top: 6px;
  flex-wrap: wrap;
}

.assets-month-item {
  font-size: 12px;
  font-weight: 700;
}

.assets-month-item.income {
  color: var(--green-600);
}

.assets-month-item.expense {
  color: var(--red);
}

.birth-badge {
  width: 28px;
  height: 28px;
  flex: none;
  border-radius: 9px;
  background: var(--yellow-soft);
  color: var(--yellow-ink);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.until-chip {
  flex: none;
  padding: 2px 9px;
  border-radius: 999px;
  background: var(--plain-bg);
  color: var(--text-2);
  font-size: 11px;
  font-weight: 700;
}

.until-chip.soon {
  background: var(--red-soft);
  color: var(--red);
}

/* ------------------------------ 欢迎卡片 ------------------------------ */
.hero-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 22px;
  border-radius: var(--radius-lg);
  background: linear-gradient(120deg, var(--hero-from) 0%, var(--hero-mid) 55%, var(--hero-to) 100%);
  color: #fff;
  box-shadow: 0 8px 22px var(--brand-shadow);
}

.hero-left h2 {
  font-size: 18px;
  font-weight: 800;
}

.hero-sub {
  margin-top: 5px;
  font-size: 12.5px;
  color: rgba(255, 255, 255, 0.9);
}

.hero-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}

.hero-bar {
  width: 220px;
  height: 7px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.32);
  overflow: hidden;
}

.hero-bar i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--surface);
  transition: width 0.4s ease;
}

.hero-progress-text {
  font-size: 12px;
  font-weight: 700;
}

.hero-links {
  display: flex;
  gap: 10px;
}

.quick-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
  text-decoration: none;
  transition: background 0.15s, transform 0.15s;
}

.quick-link:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
}

.quick-icon {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.24);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.quick-text {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.quick-title {
  font-size: 12.5px;
  font-weight: 700;
}

.quick-desc {
  font-size: 10.5px;
  color: rgba(255, 255, 255, 0.8);
}

/* ------------------------------ 内容布局 ------------------------------ */
.stat-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

/* 统计卡片作为整体可点击（跳转到日历统计看板） */
.stat-link {
  display: flex;
  border-radius: 14px;
  text-decoration: none;
  color: inherit;
  transition: transform 0.15s, box-shadow 0.15s;
}

.stat-link :deep(.stat-card) {
  width: 100%;
}

.stat-link:hover {
  transform: translateY(-2px);
}

.stat-link:hover :deep(.stat-card) {
  box-shadow: var(--shadow-card);
}

.stat-link:focus-visible {
  outline: 2px solid var(--green-500);
  outline-offset: 2px;
}

.home-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.home-col {
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

/* 完成状态：渐变背景淡出 + 删除线渐进 */
.task-row {
  position: relative;
  padding-left: 18px;
  border-radius: 10px;
  transition:
    background var(--dur-2) var(--ease-std),
    transform var(--dur-2) var(--ease-std);
}

.task-row.done {
  background: linear-gradient(90deg, var(--green-50), transparent 74%);
}

/* 拖拽排序反馈：源项半透明，目标项顶部/底部显示插入指示线 */
.task-row.dragging {
  opacity: 0.45;
}

.task-row.drop-before::before,
.task-row.drop-after::after {
  content: '';
  position: absolute;
  left: 6px;
  right: 6px;
  height: 2px;
  border-radius: 2px;
  background: var(--green-500);
  box-shadow: 0 0 6px var(--brand-ring);
}

.task-row.drop-before::before {
  top: -1px;
}

.task-row.drop-after::after {
  bottom: -1px;
}

/* 悬停时出现的拖拽手柄（仅未设置时间的日程可拖动） */
.drag-grip {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 18px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-3);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  user-select: none;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s;
}

.task-row:hover .drag-grip {
  opacity: 1;
}

.drag-grip:hover {
  color: var(--green-600);
}

.drag-grip:active {
  cursor: grabbing;
}

/* 置顶图钉：常显半透明，置顶时高亮 */
.pin-btn {
  opacity: 0.5;
  transition: opacity 0.15s, color 0.15s;
}

.pin-btn:hover {
  opacity: 1;
  color: var(--green-600);
}

.pin-btn.active {
  opacity: 1;
  color: var(--green-600);
}

.round-check.checked {
  animation: check-pop var(--dur-2) var(--ease-std);
}

@keyframes check-pop {
  0% {
    transform: scale(0.72);
  }
  60% {
    transform: scale(1.12);
  }
  100% {
    transform: scale(1);
  }
}

.row-time {
  width: 44px;
  flex: none;
  font-size: 12.5px;
  font-weight: 800;
  color: var(--green-600);
  font-variant-numeric: tabular-nums;
}

.row-time.all-day {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-3);
}

.row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.row-title {
  position: relative;
  display: inline-block;
  max-width: 100%;
  font-size: 12.8px;
  font-weight: 700;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color var(--dur-2) var(--ease-std);
}

/* 删除线渐进：伪元素从左向右展开 */
.row-title::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 56%;
  height: 1px;
  background: currentColor;
  transform: scaleX(0);
  transform-origin: left center;
  transition: transform var(--dur-3) var(--ease-std);
}

.task-row.done .row-title {
  color: var(--text-3);
}

.task-row.done .row-title::after {
  transform: scaleX(1);
}

.row-desc {
  font-size: 11.5px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

@media (max-width: 1240px) {
  .stat-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .hero-card {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 1160px) {
  .home-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 560px) {
  .stat-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>