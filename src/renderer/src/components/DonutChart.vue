<script setup lang="ts">
/**
 * 只读环形进度图：用于每日计划数据看板与日历完成率展示。
 * 与 ProgressRing 的区别：不可点击、无图标，中心展示数值与说明文字。
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 百分比（0-100，超出范围自动收敛） */
    percent: number
    size?: number
    /** 中心主文案（默认显示百分比数值） */
    label?: string
    /** 中心副文案 */
    sub?: string
    tone?: 'green' | 'blue' | 'yellow' | 'red'
  }>(),
  { size: 132, label: '', sub: '', tone: 'green' }
)

const STROKE = 10
const radius = computed(() => props.size / 2 - STROKE)
const circumference = computed(() => 2 * Math.PI * radius.value)
const value = computed(() => Math.max(0, Math.min(100, Math.round(props.percent))))
const offset = computed(() => circumference.value * (1 - value.value / 100))
const color = computed(() => {
  if (props.tone === 'blue') return 'var(--blue)'
  if (props.tone === 'yellow') return 'var(--yellow)'
  if (props.tone === 'red') return 'var(--red)'
  return 'var(--green-500)'
})
</script>

<template>
  <div class="donut" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg :width="size" :height="size">
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        :style="{ stroke: 'var(--border)' }"
        :stroke-width="STROKE"
      />
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        :style="{ stroke: color }"
        :stroke-width="STROKE"
        stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="offset"
        :transform="`rotate(-90 ${size / 2} ${size / 2})`"
        class="donut-progress"
      />
    </svg>
    <div class="donut-center">
      <span class="donut-value">{{ label || `${value}%` }}</span>
      <span v-if="sub" class="donut-sub">{{ sub }}</span>
    </div>
  </div>
</template>

<style scoped>
.donut {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.donut-progress {
  transition: stroke-dashoffset var(--dur-3) var(--ease-std);
}

.donut-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  text-align: center;
}

.donut-value {
  font-size: 26px;
  font-weight: 800;
  color: var(--text-1);
  font-variant-numeric: tabular-nums;
}

.donut-sub {
  font-size: 11px;
  color: var(--text-3);
}
</style>