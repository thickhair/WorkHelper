<script setup lang="ts">
/**
 * 习惯编辑弹窗：名称、图标（emoji）、每日目标次数（自绘步进器，去除原生数字微调框）。
 */
import { computed, ref, watch } from 'vue'
import type { Habit } from '@shared/types'
import Icon from './Icon.vue'
import ModalDialog from './ModalDialog.vue'

const props = defineProps<{
  visible: boolean
  habit?: Habit | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', value: { name: string; icon: string; target: number }): void
}>()

/** 常用图标候选（6 列 × 5 行，emoji 风格保持一致） */
const ICON_CHOICES = [
  '🏃', '📖', '📚', '💧', '🌅', '🧘',
  '✍️', '🎧', '🥗', '😴', '💪', '🎬',
  '🚶', '🚴', '🏊', '☀️', '🌙', '🥛',
  '🍎', '🥦', '💊', '🧹', '🪴', '🐶',
  '🎓', '🧠', '💻', '💰', '🎨', '📝'
]

/** 每日目标次数范围（与提交校验保持一致） */
const TARGET_MIN = 1
const TARGET_MAX = 20

const name = ref('')
const icon = ref('🏃')
/** 目标次数文本（仅数字，失焦时钳制到 1–20） */
const targetText = ref('1')
const error = ref('')

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    error.value = ''
    name.value = props.habit?.name ?? ''
    icon.value = props.habit?.icon ?? '🏃'
    targetText.value = String(props.habit?.target ?? TARGET_MIN)
  },
  { immediate: true }
)

/** 当前目标次数（过滤非数字并钳制到合法范围） */
const targetValue = computed(() => clampTarget(targetText.value))

function clampTarget(value: string | number): number {
  const parsed = Number.parseInt(String(value).replace(/\D/g, ''), 10)
  if (Number.isNaN(parsed)) return TARGET_MIN
  return Math.min(TARGET_MAX, Math.max(TARGET_MIN, parsed))
}

/** 步进：±1 并按边界钳制 */
function stepTarget(delta: number): void {
  targetText.value = String(Math.min(TARGET_MAX, Math.max(TARGET_MIN, targetValue.value + delta)))
}

/** 输入失焦时归一化展示值 */
function normalizeTarget(): void {
  targetText.value = String(targetValue.value)
}

function submit(): void {
  if (!name.value.trim()) {
    error.value = '请填写习惯名称'
    return
  }
  emit('save', {
    name: name.value.trim(),
    icon: icon.value,
    target: targetValue.value
  })
}
</script>

<template>
  <ModalDialog :visible="visible" :title="habit ? '编辑习惯' : '添加习惯'" @close="emit('close')">
    <div class="field">
      <label class="field-label">习惯名称</label>
      <input
        v-model="name"
        class="input"
        placeholder="如：跑步 / 多喝水 / 早起"
        @keyup.enter="submit"
      />
    </div>

    <div class="field">
      <label class="field-label">图标</label>
      <div class="icon-picks">
        <button
          v-for="item in ICON_CHOICES"
          :key="item"
          type="button"
          class="icon-pick"
          :class="{ active: icon === item }"
          @click="icon = item"
        >
          {{ item }}
        </button>
      </div>
    </div>

    <div class="field">
      <label class="field-label">每日目标次数</label>
      <div class="stepper">
        <button
          type="button"
          class="stepper-btn"
          title="减少"
          aria-label="减少目标次数"
          :disabled="targetValue <= TARGET_MIN"
          @click="stepTarget(-1)"
        >
          −
        </button>
        <input
          v-model="targetText"
          class="stepper-input"
          type="text"
          inputmode="numeric"
          aria-label="每日目标次数"
          @blur="normalizeTarget"
          @keyup.enter="submit"
        />
        <button
          type="button"
          class="stepper-btn"
          title="增加"
          aria-label="增加目标次数"
          :disabled="targetValue >= TARGET_MAX"
          @click="stepTarget(1)"
        >
          ＋
        </button>
      </div>
    </div>

    <p v-if="error" class="form-error">
      <Icon name="info" :size="13" />{{ error }}
    </p>

    <template #footer>
      <button class="btn btn-plain" @click="emit('close')">取消</button>
      <button class="btn btn-primary" @click="submit">
        <Icon name="check" :size="13" />保存
      </button>
    </template>
  </ModalDialog>
</template>

<style scoped>
.icon-picks {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
}

.icon-pick {
  height: 34px;
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  background: var(--surface);
  font-size: 16px;
  cursor: pointer;
  transition: all 0.15s;
}

.icon-pick:hover {
  border-color: var(--green-400);
}

.icon-pick.active {
  border-color: var(--green-500);
  background: var(--green-50);
  transform: scale(1.05);
}

/* ------------------------------ 目标次数步进器 ------------------------------ */
.stepper {
  display: flex;
  align-items: center;
  height: 34px;
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  background: var(--surface);
  overflow: hidden;
  transition:
    border-color var(--dur-1) var(--ease-std),
    box-shadow var(--dur-1) var(--ease-std);
}

.stepper:focus-within {
  border-color: var(--green-500);
  box-shadow: 0 0 0 3px var(--brand-ring);
}

.stepper-btn {
  width: 36px;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--text-2);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  transition:
    background var(--dur-1) var(--ease-std),
    color var(--dur-1) var(--ease-std);
}

.stepper-btn:hover:not(:disabled) {
  background: var(--green-50);
  color: var(--green-700);
}

.stepper-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.stepper-input {
  flex: 1;
  height: 100%;
  min-width: 0;
  border: none;
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
  background: transparent;
  color: var(--text-1);
  font-size: 13.5px;
  font-weight: 700;
  font-family: inherit;
  text-align: center;
  outline: none;
  font-variant-numeric: tabular-nums;
}

.form-error {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--red);
  font-size: 12px;
}
</style>