/**
 * 渲染进程入口：挂载 Vue 应用、注册 Pinia 与路由。
 * 挂载前先读取并应用主题，避免启动时出现配色闪烁。
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useThemeStore } from './stores/theme'
import './styles/theme.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia).use(router)

const themeStore = useThemeStore()
themeStore
  .init()
  .catch(() => themeStore.applyLocal(themeStore.current))
  .finally(() => app.mount('#app'))