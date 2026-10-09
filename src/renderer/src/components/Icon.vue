<script setup lang="ts">
/**
 * 通用图标组件：按名称渲染内置 SVG 图标。
 */
import { computed } from 'vue'
import { ICONS } from './icons'

const props = withDefaults(
  defineProps<{
    name: string
    size?: number | string
    strokeWidth?: number
  }>(),
  { size: 16, strokeWidth: 1.8 }
)

const pixelSize = computed(() =>
  typeof props.size === 'number' ? `${props.size}px` : props.size
)
const content = computed(() => ICONS[props.name] ?? '')
</script>

<template>
  <svg
    class="icon"
    :width="pixelSize"
    :height="pixelSize"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="content"
  />
</template>

<style scoped>
.icon {
  display: inline-block;
  flex: none;
  vertical-align: middle;
}
</style>