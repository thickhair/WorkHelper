<script setup lang="ts">
/**
 * 迷你柱状图：展示近 N 天任务完成情况（纯 SVG 绘制，无第三方依赖）。
 */
import { computed } from 'vue'
import { monthDayLabel } from '@shared/logic'

const props = withDefaults(
  defineProps<{
    points: Array<{ date: string; done: number; total: number }>
    height?: number
  }>(),
  { height: 108 }
)

const maxValue = computed(() => Math.max(1, ...props.points.map((p) => Math.max(p.total, p.done))))

const bars = computed(() =>
  props.points.map((p) => ({
    label: monthDayLabel(p.date),
    done: p.done,
    total: p.total,
    doneHeight: Math.round((p.done / maxValue.value) * 100),
    totalHeight: Math.round((p.total / maxValue.value) * 100)
  }))
)
</script>

<template>
  <div class="mini-chart" :style="{ height: `${height}px` }">
    <div v-for="bar in bars" :key="bar.label" class="bar-col" :title="`${bar.label}：完成 ${bar.done}/${bar.total}`">
      <div class="bar-track">
        <span class="bar-total" :style="{ height: `${bar.totalHeight}%` }"></span>
        <span class="bar-done" :style="{ height: `${bar.doneHeight}%` }"></span>
      </div>
      <span class="bar-label">{{ bar.label }}</span>
    </div>
  </div>
</template>

<style scoped>
.mini-chart {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding-top: 6px;
}

.bar-col {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  min-width: 0;
}

.bar-track {
  position: relative;
  width: 100%;
  max-width: 26px;
  height: calc(100% - 20px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.bar-total {
  position: absolute;
  bottom: 0;
  width: 100%;
  border-radius: 6px 6px 4px 4px;
  background: var(--green-100);
  transition: height 0.4s ease;
}

.bar-done {
  position: relative;
  width: 62%;
  border-radius: 5px 5px 3px 3px;
  background: linear-gradient(180deg, var(--green-400), var(--green-600));
  transition: height 0.4s ease;
}

.bar-label {
  font-size: 10.5px;
  color: var(--text-3);
  white-space: nowrap;
}
</style>