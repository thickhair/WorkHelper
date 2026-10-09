<script setup lang="ts">
/**
 * 专注计时器（悬浮卡片）：对「下一个任务」进行倒计时专注，
 * 完成时回调实际专注分钟数，放弃时不记录。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Icon from './Icon.vue'

const props = withDefaults(
  defineProps<{
    title: string
    plannedMinutes?: number
  }>(),
  { plannedMinutes: 25 }
)

const emit = defineEmits<{
  (e: 'finish', minutes: number): void
  (e: 'cancel'): void
}>()

const totalSeconds = Math.max(1, Math.round(props.plannedMinutes)) * 60
const remaining = ref(totalSeconds)
const elapsedSeconds = computed(() => totalSeconds - remaining.value)

let timer: ReturnType<typeof setInterval> | null = null

const display = computed(() => {
  const m = Math.floor(remaining.value / 60)
  const s = remaining.value % 60
  return `${`${m}`.padStart(2, '0')}:${`${s}`.padStart(2, '0')}`
})

const progress = computed(() => Math.round((elapsedSeconds.value / totalSeconds) * 100))
const finished = computed(() => remaining.value <= 0)

function tick(): void {
  if (remaining.value > 0) remaining.value -= 1
}

onMounted(() => {
  timer = setInterval(tick, 1000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

/** 完成：至少记录 1 分钟 */
function finish(): void {
  emit('finish', Math.max(1, Math.round(elapsedSeconds.value / 60)))
}

function cancel(): void {
  emit('cancel')
}
</script>

<template>
  <div class="focus-timer">
    <div class="ft-head">
      <span class="ft-icon"><Icon name="clock" :size="14" /></span>
      <span class="ft-title">专注中</span>
      <button class="icon-btn ft-close" title="关闭" @click="cancel">
        <Icon name="close" :size="13" />
      </button>
    </div>

    <div class="ft-task">{{ title }}</div>

    <div class="ft-time" :class="{ finished }">{{ display }}</div>
    <div class="ft-bar">
      <span :style="{ width: `${progress}%` }"></span>
    </div>

    <div class="ft-foot">
      <button class="btn btn-plain btn-sm" @click="cancel">放弃</button>
      <button class="btn btn-primary btn-sm" @click="finish">
        <Icon name="check" :size="12" />完成
      </button>
    </div>
  </div>
</template>

<style scoped>
.focus-timer {
  position: fixed;
  right: 26px;
  bottom: 26px;
  width: 232px;
  padding: 14px;
  border-radius: var(--radius-lg);
  background: linear-gradient(160deg, var(--card), var(--green-50));
  box-shadow: var(--shadow-float);
  border: 1px solid var(--brand-ring);
  z-index: 1500;
}

.ft-head {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ft-icon {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--green-100);
  color: var(--green-700);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.ft-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--green-700);
}

.ft-close {
  margin-left: auto;
  width: 22px;
  height: 22px;
}

.ft-task {
  margin-top: 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ft-time {
  margin-top: 6px;
  font-size: 30px;
  font-weight: 800;
  letter-spacing: 1px;
  color: var(--green-700);
  font-variant-numeric: tabular-nums;
}

.ft-time.finished {
  color: var(--yellow);
}

.ft-bar {
  margin-top: 8px;
  height: 5px;
  border-radius: 999px;
  background: var(--green-100);
  overflow: hidden;
}

.ft-bar span {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--green-400), var(--green-600));
  transition: width 0.9s linear;
}

.ft-foot {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>