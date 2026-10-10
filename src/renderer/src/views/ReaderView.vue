<script setup lang="ts">
/**
 * 阅读页：加载书籍内容并创建对应阅读引擎（EPUB / PDF / TXT / Markdown），
 * 提供翻页、进度跳转、目录（EPUB）、书签管理与阅读设置；
 * 阅读进度自动保存（防抖）并在退出时落库。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Book, Bookmark } from '@shared/types'
import {
  DEFAULT_READER_SETTINGS,
  READER_FORMAT_LABELS,
  formatFileSize,
  normalizeReaderSettings,
  resolveReaderPalette,
  type ReaderSettings
} from '@shared/reader'
import { createReaderEngine, type ReaderEngine, type ReaderLocation, type ReaderTocItem } from '../reader'
import Icon from '../components/Icon.vue'
import ReaderTocPanel from '../components/reader/ReaderTocPanel.vue'
import ReaderBookmarkList from '../components/reader/ReaderBookmarkList.vue'
import ReaderSettingsPanel from '../components/reader/ReaderSettingsPanel.vue'
import { useThemeStore } from '../stores/theme'
import { useToastStore } from '../stores/toast'

type PanelKind = 'toc' | 'bookmarks' | 'settings'

const route = useRoute()
const router = useRouter()
const themeStore = useThemeStore()
const toast = useToastStore()

const bookRef = ref<Book | null>(null)
const settings = ref<ReaderSettings>({ ...DEFAULT_READER_SETTINGS })
const bookmarks = ref<Bookmark[]>([])
const location = ref<ReaderLocation>({ location: '', percent: 0, label: '正在打开…' })
const toc = ref<ReaderTocItem[]>([])
const loading = ref(true)
const error = ref('')
const activePanel = ref<PanelKind | null>(null)
const stageEl = ref<HTMLElement | null>(null)
const engineRef = shallowRef<ReaderEngine | null>(null)
/** 全屏沉浸：隐藏应用框架并切换系统全屏，控制栏随鼠标静止自动隐藏 */
const immersive = ref(false)
const controlsHidden = ref(false)

/** 主题深色判定与阅读配色（auto 跟随应用外观主题） */
const appDark = computed(() => themeStore.currentTheme.dark === true)
const palette = computed(() => resolveReaderPalette(settings.value.theme, appDark.value))
const styleVars = computed<Record<string, string>>(() => ({
  '--reader-bg': palette.value.background,
  '--reader-text': palette.value.text,
  '--reader-soft': palette.value.dark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 25, 20, 0.06)'
}))

const bookMeta = computed(() => {
  const book = bookRef.value
  if (!book) return ''
  return [book.author || '未知作者', READER_FORMAT_LABELS[book.format], formatFileSize(book.fileSize)]
    .filter(Boolean)
    .join(' · ')
})

let saveTimer: ReturnType<typeof setTimeout> | null = null
/** 加载序号：并发加载时仅最后一次生效（路由参数快速切换的场景） */
let loadToken = 0
/** 沉浸模式控制栏自动隐藏定时器 */
let hideTimer: ReturnType<typeof setTimeout> | null = null

/** 位置变化：刷新展示并防抖保存进度 */
function handleLocation(next: ReaderLocation): void {
  location.value = next
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    void persistProgress()
  }, 800)
}

async function persistProgress(): Promise<void> {
  const book = bookRef.value
  const current = location.value
  if (!book || !current.location) return
  try {
    await window.api.books.updateProgress(book.id, current.location, current.percent)
  } catch (err) {
    console.warn('[reader] 保存阅读进度失败：', err)
  }
}

/**
 * 加载 / 切换书籍：保存上一本进度、销毁旧引擎并重建（路由参数变化时重新执行）。
 */
async function openBook(id: number): Promise<void> {
  const token = ++loadToken
  // 先取上一本的进度落库（同步读取当前值），随后立即进入加载态清理旧内容
  let persist: Promise<void> | null = null
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
    persist = persistProgress()
  }
  engineRef.value?.destroy()
  engineRef.value = null
  bookRef.value = null
  toc.value = []
  bookmarks.value = []
  location.value = { location: '', percent: 0, label: '正在打开…' }
  activePanel.value = null
  error.value = ''
  loading.value = true
  if (persist) await persist

  if (!Number.isFinite(id)) {
    error.value = '书籍参数无效'
    loading.value = false
    return
  }
  try {
    const [record, savedSettings, savedBookmarks] = await Promise.all([
      window.api.books.get(id),
      window.api.reader.settings(),
      window.api.bookmarks.list(id)
    ])
    if (token !== loadToken) return
    if (!record) throw new Error('书籍不存在或已被移除')
    bookRef.value = record
    settings.value = normalizeReaderSettings(savedSettings)
    bookmarks.value = savedBookmarks

    const data =
      record.format === 'txt' || record.format === 'md'
        ? await window.api.books.text(id)
        : await window.api.books.file(id)
    if (token !== loadToken) return

    await nextTick()
    if (!stageEl.value) throw new Error('阅读器初始化失败')
    const engine = createReaderEngine(record, data, {
      container: stageEl.value,
      settings: settings.value,
      palette: palette.value,
      onLocationChange: handleLocation
    })
    if (token !== loadToken) {
      engine.destroy()
      return
    }
    engineRef.value = engine
    await engine.load()
    if (token !== loadToken) return
    toc.value = engine.toc
    // 引擎加载完成后回填初始位置（部分格式不在加载阶段派发位置变化事件）
    if (!location.value.location) {
      const initial = engine.getLocation()
      if (initial.location) handleLocation(initial)
    }
    loading.value = false
  } catch (err) {
    if (token !== loadToken) return
    error.value = (err as Error).message
    loading.value = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  void openBook(Number(route.params.id))
})

// 同一路由组件在书籍之间跳转（前进 / 后退或直接改深链）时重新加载
watch(
  () => route.params.id,
  (value) => {
    if (route.name !== 'reader-book') return
    void openBook(Number(value))
  }
)

// 全屏沉浸：仅在沉浸模式监听鼠标移动以恢复控制栏，退出时清理监听与定时器
watch(immersive, (value) => {
  if (value) {
    window.addEventListener('mousemove', onImmersiveMove, { passive: true })
  } else {
    window.removeEventListener('mousemove', onImmersiveMove)
    if (hideTimer) {
      clearTimeout(hideTimer)
      hideTimer = null
    }
    controlsHidden.value = false
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('mousemove', onImmersiveMove)
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
    void persistProgress()
  }
  // 离开阅读页时确保退出系统全屏（避免停留在全屏的应用框架界面）
  if (immersive.value) {
    immersive.value = false
    void window.api.win.setFullScreen(false).catch(() => undefined)
  }
  engineRef.value?.destroy()
  engineRef.value = null
})

/** 键盘翻页（输入控件聚焦时不拦截） */
function onKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null
  if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
  if (event.key === 'ArrowRight' || event.key === 'PageDown') {
    event.preventDefault()
    engineRef.value?.next()
  } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
    event.preventDefault()
    engineRef.value?.prev()
  } else if (event.key === 'F11') {
    event.preventDefault()
    void toggleImmersive()
  } else if (event.key === 'Escape') {
    if (activePanel.value) activePanel.value = null
    else if (immersive.value) void toggleImmersive()
  }
}

function togglePanel(kind: PanelKind): void {
  activePanel.value = activePanel.value === kind ? null : kind
}

/** 进入 / 退出全屏沉浸（同时切换系统全屏） */
async function toggleImmersive(): Promise<void> {
  const next = !immersive.value
  immersive.value = next
  controlsHidden.value = false
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  if (next) restartHideTimer()
  try {
    await window.api.win.setFullScreen(next)
  } catch (err) {
    console.warn('[reader] 切换全屏失败：', err)
  }
}

/** 控制栏自动隐藏：鼠标静止 3 秒后隐藏，移动即恢复 */
function restartHideTimer(): void {
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    if (immersive.value) controlsHidden.value = true
  }, 3000)
}

function onImmersiveMove(): void {
  if (!immersive.value) return
  controlsHidden.value = false
  restartHideTimer()
}

async function backToShelf(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  await persistProgress()
  void router.push('/reader')
}

function onSeek(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value)
  if (Number.isFinite(value)) engineRef.value?.goToPercent(value)
}

function onTocSelect(item: ReaderTocItem): void {
  engineRef.value?.goTo(item.target)
  activePanel.value = null
}

async function addBookmark(): Promise<void> {
  const book = bookRef.value
  const current = engineRef.value?.getLocation()
  if (!book || !current || !current.location) {
    toast.error('当前位置暂不支持添加书签')
    return
  }
  try {
    const created = await window.api.bookmarks.create({
      bookId: book.id,
      location: current.location,
      label: current.label,
      percent: current.percent
    })
    bookmarks.value = [...bookmarks.value, created].sort((a, b) => a.percent - b.percent)
    toast.success('已添加书签')
  } catch (err) {
    toast.error((err as Error).message)
  }
}

function jumpBookmark(bookmark: Bookmark): void {
  engineRef.value?.goTo(bookmark.location)
  activePanel.value = null
}

async function removeBookmark(bookmark: Bookmark): Promise<void> {
  try {
    await window.api.bookmarks.remove(bookmark.id)
    bookmarks.value = bookmarks.value.filter((item) => item.id !== bookmark.id)
    toast.push('已删除书签', 'info')
  } catch (err) {
    toast.error((err as Error).message)
  }
}

/** 阅读设置变更：即时应用并持久化 */
async function updateSettings(next: ReaderSettings): Promise<void> {
  settings.value = next
  engineRef.value?.applySettings(next, resolveReaderPalette(next.theme, appDark.value))
  try {
    settings.value = await window.api.reader.setSettings(next)
  } catch (err) {
    toast.error((err as Error).message)
  }
}
</script>

<template>
  <div class="reader-page" :class="{ immersive, 'controls-hidden': controlsHidden }" :style="styleVars">
    <header class="reader-bar">
      <button class="r-btn" title="返回书架" @click="backToShelf">
        <Icon name="chevronLeft" :size="15" />
      </button>
      <div class="rb-title">
        <span class="rb-name" :title="bookRef?.title">{{ bookRef?.title ?? '阅读' }}</span>
        <span class="rb-sub">{{ bookMeta }}</span>
      </div>
      <div class="rb-actions">
        <button
          v-if="toc.length > 0"
          class="r-btn"
          :class="{ active: activePanel === 'toc' }"
          title="目录"
          @click="togglePanel('toc')"
        >
          <Icon name="list" :size="15" />
        </button>
        <button
          class="r-btn"
          :class="{ active: activePanel === 'bookmarks' }"
          title="书签"
          @click="togglePanel('bookmarks')"
        >
          <Icon name="bookmark" :size="15" />
        </button>
        <button
          class="r-btn"
          :class="{ active: activePanel === 'settings' }"
          title="阅读设置"
          @click="togglePanel('settings')"
        >
          <Icon name="type" :size="15" />
        </button>
        <button
          class="r-btn"
          :class="{ active: immersive }"
          :title="immersive ? '退出全屏沉浸（F11）' : '全屏沉浸（F11）'"
          @click="toggleImmersive"
        >
          <Icon :name="immersive ? 'compress' : 'expand'" :size="15" />
        </button>
      </div>
    </header>

    <div class="reader-body">
      <div v-if="bookRef" ref="stageEl" class="reader-stage"></div>

      <Transition name="panel-slide">
        <aside v-if="activePanel && bookRef" class="reader-panel">
          <ReaderTocPanel
            v-if="activePanel === 'toc'"
            :items="toc"
            :active-label="location.label"
            @select="onTocSelect"
            @close="activePanel = null"
          />
          <ReaderBookmarkList
            v-else-if="activePanel === 'bookmarks'"
            :bookmarks="bookmarks"
            @add="addBookmark"
            @jump="jumpBookmark"
            @remove="removeBookmark"
            @close="activePanel = null"
          />
          <ReaderSettingsPanel
            v-else
            :settings="settings"
            :format="bookRef.format"
            @update="updateSettings"
            @close="activePanel = null"
          />
        </aside>
      </Transition>

      <div v-if="loading" class="reader-overlay">
        <Icon name="refresh" :size="22" class="spin" />
        <span>正在打开《{{ bookRef?.title ?? '' }}》…</span>
      </div>
      <div v-else-if="error" class="reader-overlay error">
        <Icon name="info" :size="22" />
        <span>{{ error }}</span>
        <button class="btn btn-plain" @click="backToShelf">返回书架</button>
      </div>
    </div>

    <footer v-if="!error" class="reader-foot">
      <button class="r-btn" title="上一页" @click="engineRef?.prev()">
        <Icon name="chevronLeft" :size="15" />
      </button>
      <span class="rf-label">{{ location.label }}</span>
      <input
        class="rf-slider"
        type="range"
        min="0"
        max="100"
        step="1"
        :value="location.percent"
        title="阅读进度"
        @change="onSeek"
      />
      <span class="rf-percent">{{ location.percent }}%</span>
      <button class="r-btn" title="下一页" @click="engineRef?.next()">
        <Icon name="chevronRight" :size="15" />
      </button>
    </footer>
  </div>
</template>

<style scoped>
.reader-page {
  height: calc(100vh - var(--topbar-height));
  margin: 0 -24px -24px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: var(--reader-bg, var(--card));
  color: var(--reader-text, var(--text-1));
}

@media (max-width: 640px) {
  .reader-page {
    margin: 0 -12px -12px;
  }
}

/* ------------------------------ 全屏沉浸 ------------------------------ */
/* 覆盖整个窗口（隐藏应用侧边栏 / 顶栏，配合系统全屏隐藏任务栏） */
.reader-page.immersive {
  position: fixed;
  inset: 0;
  z-index: 100;
  height: 100vh;
  margin: 0;
}

.reader-page.immersive .reader-bar,
.reader-page.immersive .reader-foot {
  transition: opacity 0.25s var(--ease-std);
}

/* 鼠标静止后隐藏控制栏，移动鼠标即恢复 */
.reader-page.immersive.controls-hidden .reader-bar,
.reader-page.immersive.controls-hidden .reader-foot {
  opacity: 0;
  pointer-events: none;
}

/* ------------------------------ 顶部工具栏 ------------------------------ */
.reader-bar {
  flex: none;
  height: 46px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 10px;
  border-bottom: 1px solid var(--reader-soft, rgba(127, 127, 127, 0.16));
}

.rb-title {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.rb-name {
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rb-sub {
  font-size: 10.5px;
  opacity: 0.62;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rb-actions {
  display: flex;
  align-items: center;
  gap: 3px;
}

.r-btn {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0.72;
  transition:
    background var(--dur-1) var(--ease-std),
    opacity var(--dur-1) var(--ease-std);
}

.r-btn:hover {
  opacity: 1;
  background: var(--reader-soft, rgba(127, 127, 127, 0.14));
}

.r-btn.active {
  opacity: 1;
  background: var(--reader-soft, rgba(127, 127, 127, 0.18));
}

/* ------------------------------ 阅读区 ------------------------------ */
.reader-body {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

.reader-stage {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.reader-stage :deep(.text-flow) {
  text-align: justify;
  word-break: break-word;
  transition: transform 0.18s var(--ease-std);
  will-change: transform;
}

.reader-stage :deep(.text-flow p) {
  margin: 0 0 0.55em;
}

.reader-stage :deep(.text-flow h1),
.reader-stage :deep(.text-flow h2),
.reader-stage :deep(.text-flow h3),
.reader-stage :deep(.text-flow h4) {
  margin: 0.9em 0 0.5em;
  line-height: 1.4;
}

.reader-stage :deep(.text-flow h1) {
  font-size: 1.5em;
}

.reader-stage :deep(.text-flow h2) {
  font-size: 1.3em;
}

.reader-stage :deep(.text-flow h3) {
  font-size: 1.14em;
}

.reader-stage :deep(.text-flow ul),
.reader-stage :deep(.text-flow ol) {
  margin: 0.4em 0 0.7em;
  padding-left: 1.5em;
}

.reader-stage :deep(.text-flow li) {
  margin: 0.15em 0;
}

.reader-stage :deep(.text-flow pre) {
  background: var(--reader-soft, rgba(127, 127, 127, 0.1));
  padding: 10px 12px;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 0.9em;
  line-height: 1.6;
}

.reader-stage :deep(.text-flow code) {
  font-family: Consolas, 'Cascadia Mono', monospace;
  font-size: 0.92em;
  background: var(--reader-soft, rgba(127, 127, 127, 0.1));
  padding: 0.1em 0.3em;
  border-radius: 4px;
}

.reader-stage :deep(.text-flow pre code) {
  background: transparent;
  padding: 0;
}

.reader-stage :deep(.text-flow blockquote) {
  margin: 0.7em 0;
  padding: 0.15em 0.9em;
  border-left: 3px solid var(--reader-soft, rgba(127, 127, 127, 0.4));
  opacity: 0.86;
}

.reader-stage :deep(.text-flow img) {
  max-width: 100%;
  height: auto;
}

.reader-stage :deep(.text-flow table) {
  border-collapse: collapse;
  margin: 0.6em 0;
  font-size: 0.94em;
}

.reader-stage :deep(.text-flow th),
.reader-stage :deep(.text-flow td) {
  border: 1px solid var(--reader-soft, rgba(127, 127, 127, 0.3));
  padding: 4px 9px;
}

.reader-stage :deep(.text-flow a) {
  color: inherit;
  text-decoration: underline;
  text-decoration-color: var(--reader-soft, rgba(127, 127, 127, 0.5));
}

/* ------------------------------ 面板 ------------------------------ */
.reader-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(322px, 88%);
  z-index: 6;
  background: var(--card);
  border-left: 1px solid var(--border);
  box-shadow: var(--shadow-float);
}

.panel-slide-enter-active,
.panel-slide-leave-active {
  transition:
    transform 0.2s var(--ease-std),
    opacity 0.2s var(--ease-std);
}

.panel-slide-enter-from,
.panel-slide-leave-to {
  transform: translateX(18px);
  opacity: 0;
}

/* ------------------------------ 加载 / 错误 ------------------------------ */
.reader-overlay {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 12.5px;
  background: var(--reader-bg, var(--card));
}

.reader-overlay.error {
  flex-direction: column;
  gap: 12px;
}

.spin {
  animation: reader-spin 1s linear infinite;
}

@keyframes reader-spin {
  to {
    transform: rotate(360deg);
  }
}

/* ------------------------------ 底部进度 ------------------------------ */
.reader-foot {
  flex: none;
  height: 46px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  border-top: 1px solid var(--reader-soft, rgba(127, 127, 127, 0.16));
}

.rf-label {
  font-size: 11px;
  opacity: 0.72;
  min-width: 86px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rf-slider {
  flex: 1;
  min-width: 0;
  max-width: 460px;
  margin: 0 auto;
  accent-color: var(--green-600);
  cursor: pointer;
}

.rf-percent {
  font-size: 11px;
  font-weight: 700;
  opacity: 0.72;
  min-width: 38px;
  text-align: right;
}
</style>