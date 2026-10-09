<script setup lang="ts">
/**
 * 习惯打卡进度环：SVG 环形进度 + 中心图标，点击打卡。
 */
import { computed } from 'vue'
import { percent } from '@shared/logic'

const props = defineProps<{
  icon: string
  count: number
  target: number
  size?: number
  activeColor?: string
}>()

const emit = defineEmits<{ (e: 'check'): void }>()

const size = computed(() => props.size ?? 46)
const stroke = 4
const radius = computed(() => size.value / 2 - stroke)
const circumference = computed(() => 2 * Math.PI * radius.value)
const ratio = computed(() => percent(props.count, props.target || 1) / 100)
const offset = computed(() => circumference.value * (1 - ratio.value))
const reached = computed(() => props.count >= (props.target || 1))
</script>

<template>
  <button
    class="ring"
    :class="{ reached }"
    :style="{ width: `${size}px`, height: `${size}px` }"
    :title="`${count}/${target}（点击打卡）`"
    @click="emit('check')"
  >
    <svg :width="size" :height="size" class="ring-svg">
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        :style="{ stroke: 'var(--border)' }"
        :stroke-width="stroke"
      />
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        :style="{ stroke: activeColor ?? 'var(--green-500)' }"
        :stroke-width="stroke"
        stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="offset"
        :transform="`rotate(-90 ${size / 2} ${size / 2})`"
        class="ring-progress"
      />
    </svg>
    <span class="ring-icon">{{ icon }}</span>
  </button>
</template>

<style scoped>
.ring {
  position: relative;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease;
}

.ring:hover {
  transform: scale(1.06);
}

.ring:active {
  transform: scale(0.96);
}

.ring-icon {
  position: absolute;
  font-size: 17px;
  line-height: 1;
}

.ring-progress {
  transition: stroke-dashoffset 0.35s ease;
}

.ring.reached {
  filter: drop-shadow(0 0 6px var(--brand-shadow));
}
</style>