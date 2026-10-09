<script setup lang="ts">
/**
 * 统计卡片：用于「今日任务 / 习惯打卡 / 今日进度 / 今日状态」等指标展示。
 */
import Icon from './Icon.vue'

withDefaults(
  defineProps<{
    icon: string
    label: string
    value: string
    tag?: string
    tone?: 'green' | 'yellow' | 'blue'
  }>(),
  { tone: 'green', tag: '' }
)
</script>

<template>
  <div class="stat-card" :class="tone">
    <span class="stat-icon">{{ icon }}</span>
    <div class="stat-body">
      <span class="stat-value">{{ value }}</span>
      <span class="stat-label">{{ label }}</span>
    </div>
    <span v-if="tag" class="stat-tag">
      <Icon name="sparkle" :size="11" />
      {{ tag }}
    </span>
  </div>
</template>

<style scoped>
.stat-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--green-100);
  border: 1px solid var(--brand-ring);
}

.stat-card.yellow {
  background: var(--yellow-soft);
  border-color: color-mix(in srgb, var(--yellow) 30%, transparent);
}

.stat-card.blue {
  background: var(--blue-soft);
  border-color: color-mix(in srgb, var(--blue) 30%, transparent);
}

.stat-icon {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--surface);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  flex: none;
  box-shadow: 0 2px 6px var(--brand-ring);
}

.stat-body {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
  min-width: 0;
}

.stat-value {
  font-size: 17px;
  font-weight: 800;
  letter-spacing: 0.2px;
  white-space: nowrap;
}

.stat-label {
  font-size: 11.5px;
  color: var(--text-2);
  white-space: nowrap;
}

.stat-tag {
  position: absolute;
  top: 8px;
  right: 10px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  font-weight: 600;
  color: var(--green-700);
  background: color-mix(in srgb, var(--surface) 86%, transparent);
  border-radius: 999px;
  padding: 2px 7px;
}
</style>