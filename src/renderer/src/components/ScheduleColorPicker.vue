<script setup lang="ts">
/**
 * 日程颜色选择器（受控组件）：默认（不标记）+ 8 色调色板。
 * 供任务编辑弹窗与日历「添加日程」弹窗共用。
 */
import { SCHEDULE_COLORS } from '@shared/schedule-colors'

defineProps<{ modelValue: string }>()

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()
</script>

<template>
  <div class="color-picks">
    <button
      type="button"
      class="color-pick none"
      :class="{ active: modelValue === '' }"
      title="默认（不标记）"
      aria-label="默认（不标记）"
      @click="emit('update:modelValue', '')"
    ></button>
    <button
      v-for="item in SCHEDULE_COLORS"
      :key="item.value"
      type="button"
      class="color-pick"
      :class="{ active: modelValue === item.value }"
      :style="{ background: item.value }"
      :title="item.label"
      :aria-label="item.label"
      @click="emit('update:modelValue', item.value)"
    ></button>
  </div>
</template>

<style scoped>
.color-picks {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 9px;
  padding: 2px 0;
}

.color-pick {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: none;
  padding: 0;
  cursor: pointer;
  transition:
    transform var(--dur-1) var(--ease-std),
    box-shadow var(--dur-1) var(--ease-std);
}

.color-pick:hover {
  transform: scale(1.12);
}

.color-pick.active {
  box-shadow:
    0 0 0 2px var(--surface),
    0 0 0 3.5px var(--green-500);
}

/* 默认（不标记）：虚线圈 + 斜线 */
.color-pick.none {
  position: relative;
  background: var(--surface);
  border: 1.6px dashed var(--border-strong);
  overflow: hidden;
}

.color-pick.none::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 140%;
  height: 1.6px;
  background: var(--text-3);
  transform: translate(-50%, -50%) rotate(-45deg);
}
</style>