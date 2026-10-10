<script setup lang="ts">
/**
 * 通用弹窗组件：标题 + 内容插槽 + 底部按钮插槽。
 */
import Icon from './Icon.vue'

withDefaults(
  defineProps<{
    visible: boolean
    title: string
    width?: string
  }>(),
  { width: '440px' }
)

const emit = defineEmits<{ (e: 'close'): void }>()
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="modal-mask" @click.self="emit('close')">
        <div class="modal" :style="{ width }">
          <div class="modal-head">
            <span class="modal-title">{{ title }}</span>
            <button class="icon-btn" title="关闭" @click="emit('close')">
              <Icon name="close" :size="14" />
            </button>
          </div>
          <div class="modal-body">
            <slot />
          </div>
          <div class="modal-foot">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  background: var(--overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(3px);
}

.modal {
  max-width: calc(100vw - 80px);
  max-height: calc(100vh - 80px);
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-pop);
  overflow: hidden;
}

.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px 10px;
}

.modal-title {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.2px;
}

.modal-body {
  padding: 4px 18px 8px;
  overflow: auto;
}

.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 18px 16px;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity var(--dur-2) var(--ease-std);
}

.modal-enter-active .modal,
.modal-leave-active .modal {
  transition: transform var(--dur-2) var(--ease-std);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal,
.modal-leave-to .modal {
  transform: scale(0.96) translateY(8px);
}
</style>