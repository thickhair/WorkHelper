<script setup lang="ts">
/**
 * 日程编辑弹窗：时间可选（默认「全天」不设时间）+ 颜色标记 + 备注描述。
 */
import { computed, ref, watch } from 'vue'
import Icon from './Icon.vue'
import ModalDialog from './ModalDialog.vue'
import ScheduleColorPicker from './ScheduleColorPicker.vue'

export interface ScheduleFormValue {
  time: string
  color: string
  title: string
  description: string
}

const props = withDefaults(
  defineProps<{
    visible: boolean
    initial?: Partial<ScheduleFormValue>
    isEdit?: boolean
  }>(),
  { isEdit: false }
)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', value: ScheduleFormValue): void
}>()

const form = ref<ScheduleFormValue>({ time: '', color: '', title: '', description: '' })

/** 日程是否设置了具体时间（默认不设置，仅展示为「全天」） */
const timeEnabled = ref(false)
const error = ref('')

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    error.value = ''
    const time = props.initial?.time ?? ''
    form.value = {
      time,
      color: props.initial?.color ?? '',
      title: props.initial?.title ?? '',
      description: props.initial?.description ?? ''
    }
    timeEnabled.value = time !== ''
  },
  { immediate: true }
)

/** 切换「全天 / 指定时间」；切到指定时间时若无值则给默认值 */
function setTimeEnabled(enabled: boolean): void {
  timeEnabled.value = enabled
  if (enabled && !form.value.time) form.value.time = '09:00'
}

const dialogTitle = computed(() => `${props.isEdit ? '编辑' : '添加'}日程`)

function submit(): void {
  if (!form.value.title.trim()) {
    error.value = '请填写标题内容'
    return
  }
  const value: ScheduleFormValue = { ...form.value, title: form.value.title.trim() }
  // 「全天」时清空时间，保持与数据库「空串 = 未设置」的口径一致
  if (!timeEnabled.value) value.time = ''
  emit('save', value)
}
</script>

<template>
  <ModalDialog :visible="visible" :title="dialogTitle" @close="emit('close')">
    <div class="field">
      <label class="field-label">标题</label>
      <input v-model="form.title" class="input" placeholder="如：英语学习" @keyup.enter="submit" />
    </div>

    <div class="field-row">
      <div class="field">
        <label class="field-label">时间</label>
        <div class="time-picks">
          <button
            type="button"
            class="time-pick"
            :class="{ active: !timeEnabled }"
            @click="setTimeEnabled(false)"
          >
            <Icon name="clock" :size="12" />全天
          </button>
          <button
            type="button"
            class="time-pick"
            :class="{ active: timeEnabled }"
            @click="setTimeEnabled(true)"
          >
            <Icon name="clock" :size="12" />指定时间
          </button>
        </div>
        <input v-if="timeEnabled" v-model="form.time" class="input time-input" type="time" />
      </div>
      <div class="field">
        <label class="field-label">备注描述</label>
        <input v-model="form.description" class="input" placeholder="选填，如：开启一天，元气满满" />
      </div>
    </div>

    <div class="field">
      <label class="field-label">颜色标记</label>
      <ScheduleColorPicker v-model="form.color" />
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
/* 日程时间：全天 / 指定时间 分段选择 */
.time-picks {
  display: flex;
  gap: 8px;
}

.time-pick {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
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

.time-pick:hover {
  border-color: var(--green-400);
}

.time-pick.active {
  border-color: var(--green-500);
  background: var(--green-50);
  color: var(--green-700);
  font-weight: 700;
}

.time-input {
  margin-top: 8px;
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