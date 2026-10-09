<script setup lang="ts">
/**
 * 首页仪表盘：今日概览、问候卡片、日程与待办速览、近 7 天趋势与快捷入口。
 */
import { computed, onMounted, ref } from 'vue'
import type { TrendPoint } from '@shared/types'
import { featureByRoute } from '@shared/features'
import { formatDate, greetingByHour, monthDayLabel, weekdayLabel } from '@shared/logic'
import { useAppStore } from '../stores/app'
import { usePlanStore } from '../stores/plan'
import { useSidebarStore } from '../stores/sidebar'
import { useToastStore } from '../stores/toast'
import Icon from '../components/Icon.vue'
import MiniBarChart from '../components/MiniBarChart.vue'
import StatCard from '../components/StatCard.vue'

const appStore = useAppStore()
const planStore = usePlanStore()
const sidebarStore = useSidebarStore()
const toast = useToastStore()

const today = formatDate(new Date())
const trends = ref<TrendPoint[]>([])

onMounted(async () => {
  try {
    await planStore.load(today)
    trends.value = await window.api.stats.trend(7)
  } catch (err) {
    toast.error((err as Error).message)
  }
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
  { path: '/stats', title: '数据统计', desc: '查看完成趋势', icon: 'chart' },
  { path: '/review', title: '工作复盘', desc: '记录今日收获', icon: 'notebook' }
]

/** 快捷入口仅展示已添加到侧边栏的功能 */
const quickLinks = computed(() =>
  QUICK_LINKS.filter((link) => {
    const feature = featureByRoute(link.path)
    return feature ? sidebarStore.isEnabled(feature.id) : true
  })
)

/** 「每日计划」功能是否已添加（决定日程/待办的跳转入口） */
const planEnabled = computed(() => sidebarStore.isEnabled('plan'))

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
      <span class="date-chip"><Icon name="calendar" :size="13" />{{ dateText }}</span>
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
}

.date-chip .icon {
  color: var(--green-600);
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
</style>