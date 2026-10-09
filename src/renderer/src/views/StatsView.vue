<script setup lang="ts">
/**
 * 数据统计页：关键指标、近 7 天任务趋势、习惯完成率与分类投入排行。
 */
import { computed, onMounted, ref } from 'vue'
import type { StatsOverview } from '@shared/types'
import { formatMinutes, monthDayLabel, percent } from '@shared/logic'
import { useToastStore } from '../stores/toast'
import Icon from '../components/Icon.vue'
import MiniBarChart from '../components/MiniBarChart.vue'
import StatsLineChart from '../components/StatsLineChart.vue'

const toast = useToastStore()
const overview = ref<StatsOverview | null>(null)
const loading = ref(true)

onMounted(async () => {
  try {
    overview.value = await window.api.stats.overview(7)
  } catch (err) {
    toast.error((err as Error).message)
  } finally {
    loading.value = false
  }
})

const metrics = computed(() => {
  const o = overview.value
  return [
    { icon: '✅', label: '累计完成任务', value: `${o?.totalTaskDone ?? 0} 项`, tone: 'green' as const },
    { icon: '🔥', label: '累计习惯打卡', value: `${o?.totalHabitChecks ?? 0} 次`, tone: 'yellow' as const },
    { icon: '📆', label: '连续打卡天数', value: `${o?.streakDays ?? 0} 天`, tone: 'green' as const },
    {
      icon: '⏳',
      label: '累计专注时长',
      value: formatMinutes(o?.totalFocusMinutes ?? 0),
      tone: 'blue' as const
    }
  ]
})

/** 近 7 天任务完成柱状图数据 */
const taskPoints = computed(
  () => overview.value?.trends.map((t) => ({ date: t.date, done: t.taskDone, total: t.taskTotal })) ?? []
)

/** 近 7 天习惯完成率折线图数据 */
const habitPoints = computed(
  () =>
    overview.value?.trends.map((t) => ({
      label: monthDayLabel(t.date),
      value: percent(t.habitCount, t.habitTarget)
    })) ?? []
)

/** 分类投入排行（横向条形） */
const moduleRows = computed(() => {
  const modules = overview.value?.modules ?? []
  const max = Math.max(1, ...modules.map((m) => m.minutes))
  return modules.map((m) => ({ ...m, ratio: Math.round((m.minutes / max) * 100) }))
})

const hasModuleData = computed(() => (overview.value?.modules ?? []).some((m) => m.minutes > 0))
</script>

<template>
  <div class="page">
    <header class="page-head">
      <div class="head-left">
        <span class="head-icon"><Icon name="chart" :size="17" /></span>
        <div class="head-text">
          <h1>数据统计</h1>
          <p>用数据见证每一天的积累</p>
        </div>
      </div>
    </header>

    <!-- 关键指标 -->
    <section class="metric-row">
      <div v-for="item in metrics" :key="item.label" class="metric-card" :class="item.tone">
        <span class="metric-icon">{{ item.icon }}</span>
        <div class="metric-body">
          <span class="metric-value">{{ item.value }}</span>
          <span class="metric-label">{{ item.label }}</span>
        </div>
      </div>
    </section>

    <!-- 图表区 -->
    <section class="chart-grid">
      <div class="card">
        <div class="card-header">
          <span class="card-title"><Icon name="chart" :size="15" />近 7 天任务完成趋势</span>
          <span class="card-sub">浅色为计划，深色为完成</span>
        </div>
        <div v-if="taskPoints.length === 0" class="empty">
          <span>{{ loading ? '加载中…' : '暂无数据' }}</span>
        </div>
        <MiniBarChart v-else :points="taskPoints" :height="170" />
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title"><Icon name="fire" :size="15" />近 7 天习惯完成率</span>
          <span class="card-sub">百分比</span>
        </div>
        <StatsLineChart v-if="habitPoints.length > 0" :points="habitPoints" />
        <div v-else class="empty">
          <span>{{ loading ? '加载中…' : '暂无数据' }}</span>
        </div>
      </div>
    </section>

    <!-- 分类投入排行 -->
    <section class="card">
      <div class="card-header">
        <span class="card-title"><Icon name="target" :size="15" />分类投入排行</span>
        <span class="card-sub">按累计时长排序</span>
      </div>

      <div v-if="!hasModuleData" class="empty">
        <Icon name="target" :size="26" />
        <span>还没有投入记录，去各分类模块添加记录后即可看到排行</span>
      </div>

      <div v-else class="module-rows">
        <div v-for="row in moduleRows" :key="row.moduleKey" class="module-row">
          <span class="mr-icon">{{ row.icon }}</span>
          <span class="mr-name">{{ row.name }}</span>
          <div class="mr-track">
            <span class="mr-bar" :style="{ width: `${row.ratio}%` }"></span>
          </div>
          <span class="mr-value">{{ formatMinutes(row.minutes) }} · {{ row.records }} 次</span>
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

.metric-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.metric-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 14px;
  background: var(--green-100);
  border: 1px solid var(--brand-ring);
}

.metric-card.yellow {
  background: var(--yellow-soft);
  border-color: color-mix(in srgb, var(--yellow) 30%, transparent);
}

.metric-card.blue {
  background: var(--blue-soft);
  border-color: color-mix(in srgb, var(--blue) 30%, transparent);
}

.metric-icon {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--surface);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  box-shadow: 0 2px 6px var(--brand-ring);
  flex: none;
}

.metric-body {
  display: flex;
  flex-direction: column;
}

.metric-value {
  font-size: 17px;
  font-weight: 800;
}

.metric-label {
  font-size: 11.5px;
  color: var(--text-2);
}

.chart-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.module-rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.module-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mr-icon {
  width: 26px;
  text-align: center;
  font-size: 15px;
}

.mr-name {
  width: 76px;
  flex: none;
  font-size: 12.5px;
  font-weight: 600;
}

.mr-track {
  flex: 1;
  height: 10px;
  border-radius: 999px;
  background: var(--green-50);
  overflow: hidden;
}

.mr-bar {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--green-400), var(--green-600));
  transition: width 0.5s ease;
}

.mr-value {
  width: 130px;
  flex: none;
  text-align: right;
  font-size: 11.5px;
  color: var(--text-2);
}

@media (max-width: 1240px) {
  .metric-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 1160px) {
  .chart-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>