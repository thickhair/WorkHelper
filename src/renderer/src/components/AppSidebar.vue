<script setup lang="ts">
/**
 * 左侧导航栏：Logo + 功能广场配置的功能入口（可悬停移除），当前路由高亮。
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSidebarStore } from '../stores/sidebar'
import { useToastStore } from '../stores/toast'
import Icon from './Icon.vue'

const route = useRoute()
const router = useRouter()
const sidebar = useSidebarStore()
const toast = useToastStore()

/** 侧边栏条目（顺序由功能目录决定，固定功能始终显示） */
const items = computed(() => sidebar.items)

function isActive(path: string): boolean {
  return route.path === path
}

/** 从侧边栏移除功能（可从「功能广场」重新添加） */
async function removeItem(id: string, name: string, path: string): Promise<void> {
  try {
    await sidebar.remove(id)
    toast.push(`已移除「${name}」，可在功能广场重新添加`, 'info')
    if (route.path === path) await router.push('/')
  } catch (err) {
    toast.error((err as Error).message)
  }
}

/** 打开功能广场（侧边栏未包含「功能广场」时的常驻入口） */
async function openPlaza(): Promise<void> {
  await router.push('/plaza')
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-logo">
      <span class="logo-mark">
        <Icon name="sparkle" :size="16" />
      </span>
      <div class="logo-text">
        <span class="logo-title">我的工作台</span>
        <span class="logo-sub">WorkHelper</span>
      </div>
    </div>

    <nav class="sidebar-menu">
      <RouterLink
        v-for="item in items"
        :key="item.id"
        :to="item.route"
        class="menu-item"
        :class="{ active: isActive(item.route) }"
        :title="item.name"
      >
        <Icon :name="item.icon" :size="15" />
        <span class="menu-title">{{ item.name }}</span>
        <button
          class="remove-btn"
          title="从侧边栏移除"
          @click.prevent.stop="removeItem(item.id, item.name, item.route)"
        >
          <Icon name="close" :size="10" />
        </button>
      </RouterLink>
    </nav>

    <div class="sidebar-foot">
      <button
        v-if="!sidebar.isEnabled('plaza')"
        class="foot-add"
        title="功能广场：添加或移除侧边栏功能"
        @click="openPlaza"
      >
        <Icon name="plus" :size="11" />
        <span class="foot-add-text">添加功能</span>
      </button>
      <span class="foot-text">V1.0 · 数据本地存储</span>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  flex: none;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, var(--sidebar-from) 0%, var(--sidebar-to) 100%);
  color: #fff;
  overflow: hidden;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 9px;
  height: 62px;
  padding: 0 16px;
  flex: none;
  -webkit-app-region: drag;
}

.logo-mark {
  width: 28px;
  height: 28px;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.22);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.logo-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.logo-title {
  font-size: 13.5px;
  font-weight: 700;
}

.logo-sub {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.66);
  letter-spacing: 0.4px;
}

.sidebar-menu {
  flex: 1;
  overflow-y: auto;
  padding: 4px 10px 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.sidebar-menu::-webkit-scrollbar {
  width: 4px;
}

.sidebar-menu::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.28);
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.86);
  font-size: 12.5px;
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
  flex: none;
}

.menu-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-item:hover {
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
}

.menu-item.active {
  background: rgba(255, 255, 255, 0.26);
  color: #fff;
  font-weight: 700;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
}

/* 悬停时出现的移除按钮 */
.remove-btn {
  margin-left: auto;
  width: 18px;
  height: 18px;
  flex: none;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.22);
  color: rgba(255, 255, 255, 0.9);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
}

.menu-item:hover .remove-btn {
  opacity: 1;
}

.remove-btn:hover {
  background: rgba(255, 255, 255, 0.4);
  color: #fff;
}

.sidebar-foot {
  flex: none;
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 侧边栏未包含「功能广场」时的常驻入口 */
.foot-add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  color: rgba(255, 255, 255, 0.92);
  font-size: 11.5px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.foot-add:hover {
  background: rgba(255, 255, 255, 0.3);
  color: #fff;
}

.foot-text {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.55);
}

/* 窄窗口（≤860px）：侧边栏收起为图标，给内容区留出空间 */
@media (max-width: 860px) {
  .sidebar {
    width: 60px;
  }

  .logo-text,
  .menu-title,
  .remove-btn,
  .foot-add-text,
  .foot-text {
    display: none;
  }

  .sidebar-menu {
    padding: 4px 6px 10px;
  }

  .menu-item {
    justify-content: center;
    padding: 0;
  }

  .sidebar-foot {
    padding: 8px 0 10px;
    align-items: center;
  }

  .foot-add {
    width: 28px;
    height: 28px;
    padding: 0;
  }
}
</style>