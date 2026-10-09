<script setup lang="ts">
/**
 * 折线图（纯 SVG）：展示近 N 天习惯完成率等百分比趋势。
 */
import { computed } from 'vue'

const props = defineProps<{
  points: Array<{ label: string; value: number }>
}>()

const W = 300
const H = 120
const PAD = 12

const coords = computed(() =>
  props.points.map((p, index) => {
    const step = props.points.length > 1 ? (W - PAD * 2) / (props.points.length - 1) : 0
    const x = PAD + index * step
    const y = H - PAD - (Math.min(100, Math.max(0, p.value)) / 100) * (H - PAD * 2)
    return { ...p, x, y }
  })
)

const linePath = computed(() =>
  coords.value.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
)

const areaPath = computed(() => {
  if (coords.value.length === 0) return ''
  const first = coords.value[0]
  const last = coords.value[coords.value.length - 1]
  return `${linePath.value} L${last.x.toFixed(1)},${H - PAD} L${first.x.toFixed(1)},${H - PAD} Z`
})
</script>

<template>
  <div class="line-chart">
    <svg :viewBox="`0 0 ${W} ${H}`" class="chart-svg">
      <defs>
        <linearGradient id="lineArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :style="{ stopColor: 'var(--green-500)' }" stop-opacity="0.34" />
          <stop offset="100%" :style="{ stopColor: 'var(--green-500)' }" stop-opacity="0.02" />
        </linearGradient>
      </defs>
      <!-- 网格线 -->
      <line v-for="g in [0.25, 0.5, 0.75]" :key="g" :x1="PAD" :x2="W - PAD" :y1="H - PAD - g * (H - PAD * 2)" :y2="H - PAD - g * (H - PAD * 2)" :style="{ stroke: 'var(--border)' }" stroke-width="1" vector-effect="non-scaling-stroke" />
      <path :d="areaPath" fill="url(#lineArea)" />
      <path
        :d="linePath"
        fill="none"
        :style="{ stroke: 'var(--green-600)' }"
        stroke-width="2"
        stroke-linejoin="round"
        stroke-linecap="round"
        vector-effect="non-scaling-stroke"
      />
      <circle
        v-for="(c, i) in coords"
        :key="i"
        :cx="c.x"
        :cy="c.y"
        r="2.6"
        :style="{ fill: 'var(--surface)', stroke: 'var(--green-600)' }"
        stroke-width="1.6"
        vector-effect="non-scaling-stroke"
      />
    </svg>
    <div class="labels">
      <span v-for="(p, i) in points" :key="i">{{ p.label }}</span>
    </div>
  </div>
</template>

<style scoped>
.line-chart {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.chart-svg {
  width: 100%;
  height: auto;
  aspect-ratio: 300 / 120;
  display: block;
}

.labels {
  display: flex;
  justify-content: space-between;
  padding: 0 2px;
}

.labels span {
  font-size: 10.5px;
  color: var(--text-3);
  flex: 1;
  text-align: center;
}
</style>