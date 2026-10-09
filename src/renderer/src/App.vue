<script setup lang="ts">
/**
 * 应用根组件：定义整体布局（左侧导航 + 顶部窗口控制条 + 内容区）。
 */
import { onMounted, ref } from 'vue'
import AppSidebar from './components/AppSidebar.vue'
import ToastHost from './components/ToastHost.vue'
import Icon from './components/Icon.vue'
import { useAppStore } from './stores/app'
import { useSidebarStore } from './stores/sidebar'
import { useToastStore } from './stores/toast'

const appStore = useAppStore()
const sidebarStore = useSidebarStore()
const toast = useToastStore()
const maximized = ref(false)

onMounted(async () => {
  try {
    await Promise.all([appStore.init(), sidebarStore.init()])
    maximized.value = await window.api.win.isMaximized()
    window.api.win.onMaximizeChange((value) => {
      maximized.value = value
    })
  } catch (err) {
    toast.error(`初始化失败：${(err as Error).message}`)
  }
})

async function toggleMaximize(): Promise<void> {
  maximized.value = await window.api.win.toggleMaximize()
}

function minimizeWindow(): void {
  void window.api.win.minimize()
}

function closeWindow(): void {
  void window.api.win.close()
}
</script>

<template>
  <div class="app-shell">
    <AppSidebar />
    <main class="app-main">
      <header class="window-bar">
        <div class="drag-area" @dblclick="toggleMaximize"></div>
        <div class="win-controls">
          <button class="win-btn" title="最小化" @click="minimizeWindow">
            <Icon name="minimize" :size="14" />
          </button>
          <button
            class="win-btn"
            :title="maximized ? '还原' : '最大化'"
            @click="toggleMaximize"
          >
            <Icon :name="maximized ? 'restore' : 'maximize'" :size="13" />
          </button>
          <button class="win-btn close" title="关闭" @click="closeWindow">
            <Icon name="close" :size="14" />
          </button>
        </div>
      </header>
      <section class="app-content">
        <RouterView v-slot="{ Component }">
          <Transition name="fade-slide" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </section>
    </main>
    <ToastHost />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  width: 100%;
  height: 100%;
  background: var(--bg);
}

.app-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.window-bar {
  height: var(--topbar-height);
  flex: none;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 6px;
}

.drag-area {
  flex: 1;
  height: 100%;
  -webkit-app-region: drag;
}

.win-controls {
  display: flex;
  align-items: center;
  gap: 2px;
  -webkit-app-region: no-drag;
}

.win-btn {
  width: 34px;
  height: 30px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.win-btn:hover {
  background: var(--hover-tint);
  color: var(--text-1);
}

.win-btn.close:hover {
  background: #e8564a;
  color: #fff;
}

.app-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 22px 22px;
}
</style>