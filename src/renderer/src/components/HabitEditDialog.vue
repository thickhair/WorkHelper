<script setup lang="ts">
/**
 * 习惯编辑弹窗：名称、图标（emoji）、每日目标次数。
 */
import { ref, watch } from 'vue'
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

/** 常用图标候选 */
const ICON_CHOICES = ['🏃', '📖', '📚', '💧', '🌅', '🧘', '✍️', '🎧', '🥗', '😴', '💪', '🎬']

const name = ref('')
const icon = ref('🏃')
const target = ref(1)
const error = ref('')

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    error.value = ''
    name.value = props.habit?.name ?? ''
    icon.value = props.habit?.icon ?? '🏃'
    target.value = props.habit?.target ?? 1
  },
  { immediate: true }
)

function submit(): void {
  if (!name.value.trim()) {
    error.value = '请填写习惯名称'
    return
  }
  emit('save', {
    name: name.value.trim(),
    icon: icon.value,
    target: Math.max(1, Math.min(20, Number(target.value) || 1))
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
      <input v-model.number="target" class="input" type="number" min="1" max="20" />
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

.form-error {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--red);
  font-size: 12px;
}
</style>