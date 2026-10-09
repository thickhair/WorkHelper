/**
 * 路由配置：使用 Hash 模式（兼容打包后 file:// 加载）。
 */
import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router'
import { featureByRoute } from '@shared/features'
import { useSidebarStore } from '../stores/sidebar'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/HomeView.vue'),
    meta: { title: '首页', icon: 'home' }
  },
  {
    path: '/plan',
    name: 'plan',
    component: () => import('../views/DailyPlanView.vue'),
    meta: { title: '每日计划', icon: 'calendar' }
  },
  {
    path: '/calendar',
    name: 'calendar',
    component: () => import('../views/CalendarView.vue'),
    meta: { title: '日历', icon: 'calendarDays' }
  },
  {
    path: '/assets',
    name: 'assets',
    component: () => import('../views/AssetsView.vue'),
    meta: { title: '资产', icon: 'wallet' }
  },
  {
    path: '/plaza',
    name: 'plaza',
    component: () => import('../views/PlazaView.vue'),
    meta: { title: '功能广场', icon: 'grid' }
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/SettingsView.vue'),
    meta: { title: '设置', icon: 'settings' }
  },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// 固定功能（首页 / 每日计划 / 日历 / 功能广场）始终可访问（isEnabled 恒为 true），
// 「设置」不在功能目录中，经右上角入口访问（featureByRoute 返回 undefined 直接放行），
// 已从侧边栏移除的可配置功能不可直接访问，统一跳转到侧边栏中的第一个功能（首页）
router.beforeEach(async (to) => {
  const sidebar = useSidebarStore()
  if (!sidebar.ready) {
    try {
      await sidebar.init()
    } catch {
      return true
    }
  }
  const feature = featureByRoute(to.path)
  if (!feature || sidebar.isEnabled(feature.id)) return true
  const fallback = sidebar.items[0]?.route ?? '/'
  if (fallback === to.path) return true
  return { path: fallback }
})

// 记录路由跳转，便于排查页面加载问题
router.afterEach((to) => {
  console.log('[router] 当前页面：', to.fullPath)
})

export default router