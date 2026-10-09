<script setup lang="ts">
/**
 * 首页仪表盘：今日概览、问候卡片、日程与待办速览、近 7 天趋势与快捷入口。
 */
import { computed, onMounted, ref } from 'vue'
import type { AssetsSummary, Birthday, MoodRecord, TrendPoint } from '@shared/types'
import { birthdayDateLabel, daysUntilBirthday } from '@shared/calendar'
import { featureByRoute } from '@shared/features'
import { formatMoney } from '@shared/assets'
import { moodLabel, moodStreak } from '@shared/moods'
import { addDays, formatDate, greetingByHour, monthDayLabel, weekdayLabel } from '@shared/logic'
import { useAppStore } from '../stores/app'
import { usePlanStore } from '../stores/plan'
import { useSidebarStore } from '../stores/sidebar'
import { useToastStore } from '../stores/toast'
import Icon from '../components/Icon.vue'
import MiniBarChart from '../components/MiniBarChart.vue'
import MoodPicker from '../components/MoodPicker.vue'
import StatCard from '../components/StatCard.vue'

const appStore = useAppStore()
const planStore = usePlanStore()
const sidebarStore = useSidebarStore()
const toast = useToastStore()

const today = formatDate(new Date())
const trends = ref<TrendPoint[]>([])
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
    const [trendData, birthdayData, moodData] = await Promise.all([
      window.api.stats.trend(7),
      window.api.birthdays.list(),
      window.api.moods.range(addDays(today, -366), today)
    ])
    trends.value = trendData
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

const greeting = computed(() => greetingByHour(new Date().getHours()))
const dateText = computed(() => `${monthDayLabel(today)} ${weekdayLabel(today)}`)

const statCards = computed(() => {
  const s = planStore.stats
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

const topSchedules = computed(() => planStore.schedules.slice(0, 5))
const topTodos = computed(() => planStore.todos.slice(0, 5))

/** 近 7 天任务完成数据（供迷你柱状图使用） */
const trendPoints = computed(() =>
  trends.value.map((t) => ({ date: t.date, done: t.taskDone, total: t.taskTotal }))
)

const QUICK_LINKS = [
  { path: '/plan', title: '每日计划', desc: '安排今天的时间块', icon: 'calendar' },
  { path: '/assets', title: '资产', desc: '账户与攒钱进度', icon: 'wallet' }
]

/** 快捷入口展示侧边栏中的功能（固定功能始终包含） */
const quickLinks = computed(() =>
  QUICK_LINKS.filter((link) => {
    const feature = featureByRoute(link.path)
    return feature ? sidebarStore.isEnabled(feature.id) : true
  })
)

/** 「每日计划」功能是否已添加（决定日程/待办的跳转入口） */
const planEnabled = computed(() => sidebarStore.isEnabled('plan'))

/** 「资产」功能是否已添加（决定资产概览卡片显示） */
const assetsEnabled = computed(() => sidebarStore.isEnabled('assets'))

/** 资产金额展示（默认隐藏为 ****） */
function assetText(value: number): string {
  return showAssets.value ? `¥${formatMoney(value)}` : '¥****'
}

/** 未来 60 天内即将到来的生日（含今天），按临近程度排序 */
const upcomingBirthdays = computed(() =>
  birthdays.value
    .map((item) => ({ birthday: item, daysUntil: daysUntilBirthday(item, today) }))
    .filter((item) => item.daysUntil >= 0 && item.daysUntil <= 60)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 4)
)

async function toggleSchedule(id: number, done: boolean): Promise<void> {
  try {
    await planStore.toggleSchedule(id, done)
  } catch (err) {
    toast.error((err as Error).message)
  }
}

async function toggleTodo(id: number, done: boolean): Promise<void> {
  try {
    await planStore.toggleTodo(id, done)
  } catch (err) {
    toast.error((err as Error).message)
  }
}
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

    <!-- 统计卡片（点击跳转到每日计划查看对应详情） -->
    <section class="stat-row">
      <RouterLink
        v-for="card in statCards"
        :key="card.label"
        class="stat-link"
        to="/plan"
        :title="`查看${card.label}详情`"
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
        <!-- 今日日程速览 -->
        <div class="card">
          <div class="card-header">
            <span class="card-title"><Icon name="clock" :size="15" />今日日程</span>
            <RouterLink v-if="planEnabled" class="card-action" to="/plan">
              查看全部<Icon name="chevronRight" :size="12" />
            </RouterLink>
          </div>
          <div v-if="topSchedules.length === 0" class="empty">
            <Icon name="clock" :size="24" />
            <span>今天还没有安排日程</span>
          </div>
          <div v-else class="row-list">
            <div v-for="item in topSchedules" :key="item.id" class="row">
              <span class="row-time">{{ item.time }}</span>
              <div class="row-main">
                <span class="row-title" :class="{ strike: item.done }">{{ item.title }}</span>
                <span v-if="item.description" class="row-desc">{{ item.description }}</span>
              </div>
              <button
                class="round-check"
                :class="{ checked: item.done }"
                @click="toggleSchedule(item.id, !item.done)"
              >
                <Icon name="check" :size="11" />
              </button>
            </div>
          </div>
        </div>

        <!-- 今日待办速览 -->
        <div class="card">
          <div class="card-header">
            <span class="card-title"><Icon name="list" :size="15" />今日待办</span>
            <span class="card-sub">剩余 {{ planStore.todoLeft }} 项</span>
            <RouterLink v-if="planEnabled" class="card-action" to="/plan">
              查看全部<Icon name="chevronRight" :size="12" />
            </RouterLink>
          </div>
          <div v-if="topTodos.length === 0" class="empty">
            <Icon name="list" :size="24" />
            <span>暂无待办事项</span>
          </div>
          <div v-else class="row-list">
            <div v-for="item in topTodos" :key="item.id" class="row compact">
              <button
                class="round-check"
                :class="{ checked: item.done }"
                @click="toggleTodo(item.id, !item.done)"
              >
                <Icon name="check" :size="11" />
              </button>
              <span class="row-title" :class="{ strike: item.done }">{{ item.title }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="home-col">
        <!-- 心情打卡（一键记录，显示打卡状态与连续天数） -->
        <div class="card">
          <div class="card-header">
            <span class="card-title"><Icon name="sun" :size="15" />心情打卡</span>
            <span class="card-sub">
              {{ todayMood === null ? '今天还没打卡' : `已打卡 · 连续打卡 ${moodStreakDays} 天` }}
            </span>
          </div>
          <MoodPicker :model-value="todayMood" @update:model-value="setMood" />
          <p class="mood-tip">每天点一下打卡记录心情，可在日历中回看与补记</p>
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
          <p class="mood-tip">金额为手动记账口径，点击眼睛图标可显示或隐藏</p>
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

        <!-- 近 7 天趋势 -->
        <div class="card">
          <div class="card-header">
            <span class="card-title"><Icon name="chart" :size="15" />近 7 天完成趋势</span>
            <span class="card-sub">深色为已完成</span>
          </div>
          <MiniBarChart :points="trendPoints" :height="150" />
        </div>

        <!-- 下一步行动 -->
        <div class="card">
          <div class="card-header">
            <span class="card-title"><Icon name="target" :size="15" />下一步行动</span>
          </div>
          <div v-if="planStore.nextTask" class="next-hint">
            <span class="next-badge">即将开始</span>
            <span class="next-name">{{ planStore.nextTask.time }} · {{ planStore.nextTask.title }}</span>
            <RouterLink v-if="planEnabled" to="/plan" class="btn btn-primary btn-sm">
              <Icon name="play" :size="12" />去开始
            </RouterLink>
          </div>
          <div v-else class="empty">
            <Icon name="check" :size="24" />
            <span>今日计划已全部完成</span>
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

/* --------------------------- 心情打卡与生日提醒 --------------------------- */
.mood-tip {
  margin-top: 10px;
  font-size: 11px;
  color: var(--text-3);
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

/* 统计卡片作为整体可点击（跳转到每日计划） */
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
  width: 42px;
  flex: none;
  font-size: 12.5px;
  font-weight: 800;
  color: var(--green-600);
}

.row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.row-title {
  font-size: 12.8px;
  font-weight: 700;
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

.row-title.strike {
  text-decoration: line-through;
  color: var(--text-3);
}

.next-hint {
  display: flex;
  align-items: center;
  gap: 10px;
}

.next-badge {
  padding: 2px 9px;
  border-radius: 999px;
  background: var(--yellow-soft);
  color: var(--yellow-ink);
  font-size: 11px;
  font-weight: 700;
}

.next-name {
  flex: 1;
  font-size: 12.8px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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