<script setup lang="ts">
/**
 * 设置页：外观主题、用户昵称、数据备份与恢复、数据目录、关于信息。
 */
import { onMounted, ref } from 'vue'
import type { ThemeDef } from '@shared/themes'
import { useAppStore } from '../stores/app'
import { useThemeStore } from '../stores/theme'
import { useToastStore } from '../stores/toast'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import Icon from '../components/Icon.vue'

const appStore = useAppStore()
const themeStore = useThemeStore()
const toast = useToastStore()

const nameDraft = ref('')
const driver = ref('')
const busy = ref(false)
const restoreConfirmVisible = ref(false)

onMounted(async () => {
  if (!appStore.ready) await appStore.init()
  if (!themeStore.ready) {
    try {
      await themeStore.init()
    } catch {
      themeStore.applyLocal(themeStore.current)
    }
  }
  nameDraft.value = appStore.settings?.userName ?? ''
  try {
    driver.value = await window.api.app.driver()
  } catch {
    driver.value = '未知'
  }
})

/** 切换主题：立即生效并保存 */
async function pickTheme(theme: ThemeDef): Promise<void> {
  if (themeStore.current === theme.id) return
  try {
    await themeStore.set(theme.id)
    toast.success(`已切换为「${theme.name}」主题`)
  } catch (err) {
    toast.error((err as Error).message)
  }
}

async function saveName(): Promise<void> {
  try {
    await appStore.setUserName(nameDraft.value.trim())
    toast.success('昵称已保存')
  } catch (err) {
    toast.error((err as Error).message)
  }
}

async function exportBackup(): Promise<void> {
  busy.value = true
  try {
    const path = await window.api.app.exportBackup()
    if (path) toast.success('备份已导出')
  } catch (err) {
    toast.error((err as Error).message)
  } finally {
    busy.value = false
  }
}

async function importBackup(): Promise<void> {
  restoreConfirmVisible.value = false
  busy.value = true
  try {
    const path = await window.api.app.importBackup()
    if (path) {
      toast.success('数据已恢复，正在刷新…')
      setTimeout(() => window.location.reload(), 600)
    }
  } catch (err) {
    toast.error((err as Error).message)
  } finally {
    busy.value = false
  }
}

async function openDataDir(): Promise<void> {
  await window.api.app.openDataDir()
}
</script>

<template>
  <div class="page">
    <header class="page-head">
      <div class="head-left">
        <span class="head-icon"><Icon name="settings" :size="17" /></span>
        <div class="head-text">
          <h1>设置</h1>
          <p>个性化与数据安全</p>
        </div>
      </div>
    </header>

    <!-- 外观主题 -->
    <section class="card">
      <div class="card-header">
        <span class="card-title"><Icon name="grid" :size="15" />外观主题</span>
        <span class="card-sub">选择喜欢的配色，立即生效并自动保存</span>
      </div>
      <div class="theme-grid">
        <button
          v-for="theme in themeStore.themes"
          :key="theme.id"
          class="theme-card"
          :class="{ active: themeStore.current === theme.id }"
          @click="pickTheme(theme)"
        >
          <span
            class="theme-preview"
            :style="{ background: `linear-gradient(135deg, ${theme.swatch[0]}, ${theme.swatch[1]})` }"
          >
            <span class="theme-dot" :style="{ background: theme.swatch[2] }"></span>
          </span>
          <span class="theme-name">
            {{ theme.name }}
            <Icon v-if="themeStore.current === theme.id" name="check" :size="12" />
          </span>
          <span class="theme-desc">{{ theme.desc }}</span>
        </button>
      </div>
    </section>

    <!-- 个人资料 -->
    <section class="card">
      <div class="card-header">
        <span class="card-title"><Icon name="user" :size="15" />个人资料</span>
      </div>
      <div class="setting-row">
        <div class="sr-text">
          <span class="sr-title">昵称</span>
          <span class="sr-desc">用于首页问候语展示</span>
        </div>
        <div class="sr-control">
          <input
            v-model="nameDraft"
            class="input name-input"
            placeholder="请输入昵称"
            @keyup.enter="saveName"
          />
          <button class="btn btn-primary btn-sm" @click="saveName">保存</button>
        </div>
      </div>
    </section>

    <!-- 数据安全 -->
    <section class="card">
      <div class="card-header">
        <span class="card-title"><Icon name="folder" :size="15" />数据安全</span>
        <span class="card-sub">数据仅存储在本机，可随时备份与恢复</span>
      </div>

      <div class="setting-row">
        <div class="sr-text">
          <span class="sr-title">导出数据备份</span>
          <span class="sr-desc">将全部数据导出为 JSON 文件，便于迁移或留档</span>
        </div>
        <button class="btn btn-ghost btn-sm" :disabled="busy" @click="exportBackup">
          <Icon name="download" :size="13" />导出备份
        </button>
      </div>

      <div class="setting-row">
        <div class="sr-text">
          <span class="sr-title">从备份恢复</span>
          <span class="sr-desc">导入备份文件将覆盖当前全部数据，请谨慎操作</span>
        </div>
        <button class="btn btn-danger btn-sm" :disabled="busy" @click="restoreConfirmVisible = true">
          <Icon name="upload" :size="13" />导入恢复
        </button>
      </div>

      <div class="setting-row">
        <div class="sr-text">
          <span class="sr-title">打开数据目录</span>
          <span class="sr-desc">查看本机数据库文件 workhelper.db</span>
        </div>
        <button class="btn btn-plain btn-sm" @click="openDataDir">
          <Icon name="folder" :size="13" />打开目录
        </button>
      </div>
    </section>

    <!-- 关于 -->
    <section class="card">
      <div class="card-header">
        <span class="card-title"><Icon name="info" :size="15" />关于</span>
      </div>
      <div class="about-grid">
        <div class="about-item">
          <span class="about-label">应用名称</span>
          <span class="about-value">个人工作台 WorkHelper</span>
        </div>
        <div class="about-item">
          <span class="about-label">版本</span>
          <span class="about-value">V{{ appStore.settings?.version ?? '1.0.0' }}</span>
        </div>
        <div class="about-item">
          <span class="about-label">技术栈</span>
          <span class="about-value">Electron + Vue 3 + TypeScript + SQLite</span>
        </div>
        <div class="about-item">
          <span class="about-label">数据库驱动</span>
          <span class="about-value">{{ driver }}</span>
        </div>
        <div class="about-item wide">
          <span class="about-label">数据存储位置</span>
          <span class="about-value path">{{ appStore.settings?.dataPath }}</span>
        </div>
      </div>
    </section>

    <ConfirmDialog
      :visible="restoreConfirmVisible"
      title="恢复数据"
      message="导入备份将覆盖本机现有全部数据，且无法撤销。确定继续吗？"
      confirm-text="继续导入"
      @close="restoreConfirmVisible = false"
      @confirm="importBackup"
    />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.head-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.head-icon {
  width: 34px;
  height: 34px;
  border-radius: 11px;
  background: linear-gradient(135deg, var(--green-500), var(--green-600));
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 10px var(--brand-shadow);
}

.head-text h1 {
  font-size: 16px;
  font-weight: 800;
}

.head-text p {
  font-size: 11.5px;
  color: var(--text-3);
  margin-top: 1px;
}

/* ------------------------------ 外观主题 ------------------------------ */
.theme-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.theme-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-soft);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.theme-card:hover {
  border-color: var(--green-400);
  box-shadow: var(--shadow-card);
}

.theme-card.active {
  border-color: var(--green-500);
  box-shadow: 0 0 0 2px var(--brand-ring);
}

.theme-preview {
  position: relative;
  display: block;
  height: 42px;
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.theme-dot {
  position: absolute;
  right: 6px;
  bottom: 6px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.6);
}

.theme-name {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-1);
}

.theme-name .icon {
  color: var(--green-600);
}

.theme-desc {
  font-size: 11px;
  color: var(--text-3);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 2px;
  border-bottom: 1px dashed var(--border);
}

.setting-row:last-child {
  border-bottom: none;
}

.sr-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.sr-title {
  font-size: 13px;
  font-weight: 700;
}

.sr-desc {
  font-size: 11.5px;
  color: var(--text-3);
}

.sr-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.name-input {
  width: 200px;
  height: 30px;
}

.about-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 18px;
}

.about-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.about-item.wide {
  grid-column: 1 / -1;
}

.about-label {
  font-size: 11.5px;
  color: var(--text-3);
}

.about-value {
  font-size: 12.5px;
  font-weight: 600;
}

.about-value.path {
  font-family: Consolas, 'Courier New', monospace;
  font-size: 11.5px;
  color: var(--text-2);
  word-break: break-all;
  user-select: text;
}
</style>