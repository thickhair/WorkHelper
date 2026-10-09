<script setup lang="ts">
/**
 * 日程 / 待办 / 重要事项 通用编辑弹窗。
 */
import { computed, ref, watch } from 'vue'
import type { PriorityLevel } from '@shared/types'
import Icon from './Icon.vue'
import ModalDialog from './ModalDialog.vue'

export interface TaskFormValue {
  time: string
  title: string
  description: string
  startTime: string
  endTime: string
  priority: PriorityLevel
}

const props = withDefaults(
  defineProps<{
    visible: boolean
    kind: 'schedule' | 'todo' | 'priority'
    initial?: Partial<TaskFormValue>
    isEdit?: boolean
  }>(),
  { isEdit: false }
)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', value: TaskFormValue): void
}>()

const KIND_LABEL: Record<string, string> = {
  schedule: '日程',
  todo: '待办',
  priority: '重要事项'
}

const PRIORITY_OPTIONS: Array<{ value: PriorityLevel; label: string }> = [
  { value: 'high', label: '高优先级' },
  { value: 'medium', label: '中优先级' },
  { value: 'low', label: '低优先级' }
]

const form = ref<TaskFormValue>({
  time: '09:00',
  title: '',
  description: '',
  startTime: '09:00',
  endTime: '10:00',
  priority: 'medium'
})
const error = ref('')

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    error.value = ''
    form.value = {
      time: props.initial?.time ?? '09:00',
      title: props.initial?.title ?? '',
      description: props.initial?.description ?? '',
      startTime: props.initial?.startTime ?? '09:00',
      endTime: props.initial?.endTime ?? '10:00',
      priority: props.initial?.priority ?? 'medium'
    }
  },
  { immediate: true }
)

const dialogTitle = computed(
  () => `${props.isEdit ? '编辑' : '添加'}${KIND_LABEL[props.kind] ?? ''}`
)

function submit(): void {
  if (!form.value.title.trim()) {
    error.value = '请填写标题内容'
    return
  }
  emit('save', { ...form.value, title: form.value.title.trim() })
}
</script>

<template>
  <ModalDialog :visible="visible" :title="dialogTitle" @close="emit('close')">
    <div class="field">
      <label class="field-label">标题</label>
      <input
        v-model="form.title"
        class="input"
        :placeholder="kind === 'schedule' ? '如：英语学习' : kind === 'todo' ? '如：背 50 个英语单词' : '如：完成英语学习打卡'"
        @keyup.enter="submit"
      />
    </div>

    <!-- 日程：单个时间点 -->
    <div v-if="kind === 'schedule'" class="field-row">
      <div class="field">
        <label class="field-label">时间</label>
        <input v-model="form.time" class="input" type="time" />
      </div>
      <div class="field">
        <label class="field-label">备注描述</label>
        <input v-model="form.description" class="input" placeholder="选填，如：开启一天，元气满满" />
      </div>
    </div>

    <!-- 待办 / 重要事项：时间段 -->
    <div v-else class="field-row">
      <div class="field">
        <label class="field-label">开始时间</label>
        <input v-model="form.startTime" class="input" type="time" />
      </div>
      <div class="field">
        <label class="field-label">结束时间</label>
        <input v-model="form.endTime" class="input" type="time" />
      </div>
    </div>

    <!-- 重要事项：优先级 -->
    <div v-if="kind === 'priority'" class="field">
      <label class="field-label">优先级</label>
      <div class="priority-picks">
        <button
          v-for="item in PRIORITY_OPTIONS"
          :key="item.value"
          type="button"
          class="priority-pick"
          :class="[item.value, { active: form.priority === item.value }]"
          @click="form.priority = item.value"
        >
          <span class="dot"></span>
          {{ item.label }}
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
.priority-picks {
  display: flex;
  gap: 8px;
}

.priority-pick {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-2);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
}

.priority-pick .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--green-500);
}

.priority-pick.high .dot {
  background: var(--red);
}

.priority-pick.medium .dot {
  background: var(--yellow);
}

.priority-pick.active {
  border-color: var(--green-500);
  background: var(--green-50);
  color: var(--green-700);
  font-weight: 700;
}

.form-error {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--red);
  font-size: 12px;
  margin-top: 2px;
}
</style>