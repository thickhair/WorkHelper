<script setup lang="ts">
/**
 * 轻提示容器：右上角浮层展示操作反馈。
 */
import { useToastStore } from '../stores/toast'
import Icon from './Icon.vue'

const toast = useToastStore()
</script>

<template>
  <Teleport to="body">
    <div class="toast-host">
      <TransitionGroup name="toast">
        <div v-for="item in toast.items" :key="item.id" class="toast" :class="item.type">
          <Icon
            :name="item.type === 'error' ? 'info' : item.type === 'info' ? 'info' : 'check'"
            :size="14"
          />
          <span>{{ item.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-host {
  position: fixed;
  top: 54px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  z-index: 3000;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 600;
  color: #fff;
  background: rgba(41, 58, 47, 0.92);
  box-shadow: var(--shadow-float);
  backdrop-filter: blur(4px);
}

.toast.success {
  background: rgba(64, 148, 92, 0.95);
}

.toast.error {
  background: rgba(214, 92, 80, 0.95);
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.22s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>