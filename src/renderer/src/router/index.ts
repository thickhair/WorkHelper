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
    path: '/m/:key',
    name: 'module',
    component: () => import('../views/ModuleView.vue'),
    meta: { title: '模块', icon: 'book' }
  },
  {
    path: '/focus',
    name: 'focus',
    component: () => import('../views/FocusView.vue'),
    meta: { title: '专注空间', icon: 'target' }
  },
  {
    path: '/plaza',
    name: 'plaza',
    component: () => import('../views/PlazaView.vue'),
    meta: { title: '功能广场', icon: 'grid' }
  },
  {
    path: '/news',
    name: 'news',
    component: () => import('../views/NewsView.vue'),
    meta: { title: '新闻资讯', icon: 'news' }
  },
  {
    path: '/review',
    name: 'review',
    component: () => import('../views/ReviewView.vue'),
    meta: { title: '工作复盘', icon: 'notebook' }
  },
  {
    path: '/stats',
    name: 'stats',
    component: () => import('../views/StatsView.vue'),
    meta: { title: '数据统计', icon: 'chart' }
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

// 已从侧边栏移除的功能不可直接访问，统一回到首页
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
  if (feature && !sidebar.isEnabled(feature.id)) return { path: '/' }
  return true
})

// 记录路由跳转，便于排查页面加载问题
router.afterEach((to) => {
  console.log('[router] 当前页面：', to.fullPath)
})

export default router