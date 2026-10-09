<script setup lang="ts">
/**
 * 心情选择器：5 档心情一键记录（首页与日历共用），再次点击当前心情表示取消。
 */
import { MOOD_LEVELS } from '@shared/moods'

const props = withDefaults(
  defineProps<{
    /** 当前心情等级（null 表示未记录） */
    modelValue: number | null
    /** 尺寸：md 用于首页，sm 用于日历侧栏 */
    size?: 'md' | 'sm'
  }>(),
  { size: 'md' }
)

const emit = defineEmits<{ (e: 'update:modelValue', value: number | null): void }>()

function toggle(value: number): void {
  emit('update:modelValue', props.modelValue === value ? null : value)
}
</script>

<template>
  <div class="mood-picker" :class="size">
    <button
      v-for="level in MOOD_LEVELS"
      :key="level.value"
      class="mood-btn"
      :class="[`tone-${level.tone}`, { active: modelValue === level.value }]"
      :title="modelValue === level.value ? `取消「${level.label}」` : `记录「${level.label}」`"
      @click="toggle(level.value)"
    >
      <span class="mood-emoji">{{ level.emoji }}</span>
      <span class="mood-label">{{ level.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.mood-picker {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mood-btn {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 9px 4px 7px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: var(--plain-bg);
  font-family: inherit;
  cursor: pointer;
  transition: transform 0.13s, background 0.13s, border-color 0.13s, box-shadow 0.13s;
}

.mood-btn:hover {
  transform: translateY(-2px);
  background: var(--surface);
  border-color: var(--border-strong);
  box-shadow: var(--shadow-card);
}

.mood-emoji {
  font-size: 21px;
  line-height: 1.2;
}

.mood-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-3);
}

.mood-btn.active {
  background: var(--green-100);
  border-color: var(--green-500);
  box-shadow: 0 3px 10px var(--brand-shadow);
}

.mood-btn.active .mood-label {
  color: var(--green-700);
}

/* 小尺寸（日历侧栏） */
.mood-picker.sm .mood-btn {
  padding: 6px 2px 5px;
  border-radius: 10px;
}

.mood-picker.sm .mood-emoji {
  font-size: 17px;
}

.mood-picker.sm .mood-label {
  font-size: 10px;
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
</style>