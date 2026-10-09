<script setup lang="ts">
/**
 * 通用确认弹窗（删除等危险操作二次确认）。
 */
import Icon from './Icon.vue'
import ModalDialog from './ModalDialog.vue'

withDefaults(
  defineProps<{
    visible: boolean
    title?: string
    message: string
    confirmText?: string
    /** 确认按钮色调：danger 红色（默认，用于删除类操作）/ primary 主题色 */
    confirmTone?: 'danger' | 'primary'
  }>(),
  { title: '操作确认', confirmText: '确认删除', confirmTone: 'danger' }
)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm'): void
}>()
</script>

<template>
  <ModalDialog :visible="visible" :title="title" width="360px" @close="emit('close')">
    <p class="confirm-message">
      <Icon name="info" :size="14" />
      <span>{{ message }}</span>
    </p>
    <template #footer>
      <button class="btn btn-plain" @click="emit('close')">取消</button>
      <button class="btn" :class="confirmTone === 'primary' ? 'btn-primary' : 'btn-danger'" @click="emit('confirm')">
        {{ confirmText }}
      </button>
    </template>
  </ModalDialog>
</template>

<style scoped>
.confirm-message {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.6;
  padding: 4px 0 8px;
}

.confirm-message .icon {
  color: var(--yellow);
  margin-top: 2px;
}
</style>