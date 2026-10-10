<script setup lang="ts">
/**
 * 心情选择器（紧凑版）：悬停预览心情（图标放大 + 名称气泡），点击打卡；
 * 再次点击当前心情表示取消打卡。首页与日历共用（md 首页 / sm 日历）。
 */
import { MOOD_LEVELS } from '@shared/moods'

withDefaults(
  defineProps<{
    /** 当前心情等级（null 表示未记录） */
    modelValue: number | null
    /** 尺寸：md 用于首页，sm 用于日历侧栏 */
    size?: 'md' | 'sm'
  }>(),
  { size: 'md' }
)

const emit = defineEmits<{ (e: 'update:modelValue', value: number | null): void }>()

function toggle(value: number, current: number | null): void {
  emit('update:modelValue', current === value ? null : value)
}
</script>

<template>
  <div class="mood-picker" :class="size">
    <button
      v-for="level in MOOD_LEVELS"
      :key="level.value"
      type="button"
      class="mood-btn"
      :class="[`tone-${level.tone}`, { active: modelValue === level.value }]"
      :data-label="level.label"
      :title="modelValue === level.value ? `点击取消「${level.label}」` : `悬停预览，点击打卡「${level.label}」`"
      @click="toggle(level.value, modelValue)"
    >
      <span class="mood-emoji">{{ level.emoji }}</span>
    </button>
  </div>
</template>

<style scoped>
.mood-picker {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mood-btn {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 999px;
  background: var(--plain-bg);
  font-family: inherit;
  cursor: pointer;
  transition: transform 0.13s, background 0.13s, border-color 0.13s, box-shadow 0.13s;
}

.mood-btn:hover {
  background: var(--surface);
  border-color: var(--border-strong);
  box-shadow: var(--shadow-card);
}

.mood-btn:active {
  transform: scale(0.94);
}

.mood-emoji {
  font-size: 20px;
  line-height: 1;
  transition: transform 0.15s var(--ease-std);
}

/* 悬停预览：图标放大 */
.mood-btn:hover .mood-emoji {
  transform: scale(1.28);
}

/* 悬停预览：名称气泡（使用 data-label 生成，不占布局空间） */
.mood-btn::after {
  content: attr(data-label);
  position: absolute;
  left: 50%;
  bottom: calc(100% + 6px);
  transform: translateX(-50%) translateY(4px);
  padding: 2px 8px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  box-shadow: var(--shadow-float);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-2);
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s, transform 0.15s;
  z-index: 5;
}

.mood-btn:hover::after {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.mood-btn.active {
  background: var(--green-100);
  border-color: var(--green-500);
  box-shadow: 0 3px 10px var(--brand-shadow);
  animation: mood-pop 0.28s var(--ease-std);
}

@keyframes mood-pop {
  0% {
    transform: scale(0.8);
  }
  55% {
    transform: scale(1.18);
  }
  100% {
    transform: scale(1);
  }
}

/* 色调：选中时使用各等级对应的柔和底色 */
.mood-btn.active.tone-red {
  background: var(--red-soft);
  border-color: var(--red);
}

.mood-btn.active.tone-blue {
  background: var(--blue-soft);
  border-color: var(--blue);
}

.mood-btn.active.tone-yellow {
  background: var(--yellow-soft);
  border-color: var(--yellow);
}

/* 小尺寸（日历侧栏） */
.mood-picker.sm .mood-btn {
  height: 28px;
}

.mood-picker.sm .mood-emoji {
  font-size: 16px;
}

.mood-picker.sm .mood-btn::after {
  font-size: 10px;
}
</style>