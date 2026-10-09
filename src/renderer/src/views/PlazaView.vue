<script setup lang="ts">
/**
 * 功能广场：集中管理侧边栏功能（添加 / 移除 / 恢复默认），
 * 添加后的功能会立即显示在左侧导航栏。
 */
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  FEATURE_CATALOG,
  FEATURE_GROUP_LABELS,
  type FeatureDef,
  type FeatureGroup
} from '@shared/features'
import { useSidebarStore } from '../stores/sidebar'
import { useToastStore } from '../stores/toast'
import Icon from '../components/Icon.vue'

/** 分组展示顺序 */
const GROUP_ORDER: FeatureGroup[] = ['core', 'learn', 'tool', 'system']

const sidebar = useSidebarStore()
const toast = useToastStore()
const router = useRouter()

onMounted(async () => {
  if (sidebar.ready) return
  try {
    await sidebar.init()
  } catch (err) {
    toast.error((err as Error).message)
  }
})

/** 按分组组织的功能列表 */
const groups = computed(() =>
  GROUP_ORDER.map((group) => ({
    group,
    label: FEATURE_GROUP_LABELS[group],
    features: FEATURE_CATALOG.filter((f) => f.group === group)
  })).filter((item) => item.features.length > 0)
)

/** 已显示在侧边栏的功能数量（含固定功能） */
const enabledCount = computed(() => sidebar.items.length)

function isEnabled(def: FeatureDef): boolean {
  return sidebar.isEnabled(def.id)
}

/** 添加到侧边栏 */
async function addFeature(def: FeatureDef): Promise<void> {
  try {
    await sidebar.add(def.id)
    toast.success(`已添加「${def.name}」到侧边栏`)
  } catch (err) {
    toast.error((err as Error).message)
  }
}

/** 从侧边栏移除（数据不受影响，可随时加回） */
async function removeFeature(def: FeatureDef): Promise<void> {
  try {
    await sidebar.remove(def.id)
    toast.push(`已移除「${def.name}」，数据不会丢失`, 'info')
    if (router.currentRoute.value.path === def.route) await router.push('/')
  } catch (err) {
    toast.error((err as Error).message)
  }
}

/** 恢复默认侧边栏配置 */
async function restoreDefaults(): Promise<void> {
  try {
    await sidebar.restoreDefaults()
    toast.success('已恢复默认侧边栏')
  } catch (err) {
    toast.error((err as Error).message)
  }
}

/** 打开功能页面 */
async function openFeature(def: FeatureDef): Promise<void> {
  await router.push(def.route)
}
</script>

<template>
  <div class="page">
    <header class="page-head">
      <div class="head-left">
        <span class="head-icon"><Icon name="grid" :size="17" /></span>
        <div class="head-text">
          <h1>功能广场</h1>
          <p>自由组合侧边栏功能，打造属于你的工作台</p>
        </div>
      </div>
    </header>

    <!-- 概览 -->
    <section class="card summary-card">
      <div class="sc-text">
        <span class="sc-title">已添加 {{ enabledCount }} / {{ FEATURE_CATALOG.length }} 项功能</span>
        <span class="sc-desc">移除功能只是从侧边栏隐藏，数据不会删除，可随时重新添加</span>
      </div>
      <button class="btn btn-ghost btn-sm" @click="restoreDefaults">
        <Icon name="restore" :size="12" />恢复默认
      </button>
    </section>

    <!-- 分组功能卡片 -->
    <section v-for="group in groups" :key="group.group" class="card">
      <div class="card-header">
        <span class="card-title"><Icon name="grid" :size="15" />{{ group.label }}</span>
        <span v-if="group.group === 'system'" class="card-sub">固定显示，不可移除</span>
      </div>

      <div class="feature-grid">
        <div
          v-for="feature in group.features"
          :key="feature.id"
          class="feature-card"
          :class="{ enabled: isEnabled(feature) }"
        >
          <span class="fc-icon"><Icon :name="feature.icon" :size="16" /></span>
          <div class="fc-body">
            <span class="fc-name">
              {{ feature.name }}
              <span v-if="feature.fixed" class="tag tag-plain">固定</span>
              <span v-else-if="isEnabled(feature)" class="tag">已添加</span>
            </span>
            <span class="fc-desc">{{ feature.desc }}</span>
          </div>
          <div class="fc-actions">
            <button
              v-if="feature.fixed"
              class="icon-btn"
              title="打开"
              @click="openFeature(feature)"
            >
              <Icon name="arrowRight" :size="13" />
            </button>
            <template v-else>
              <button
                v-if="isEnabled(feature)"
                class="btn btn-plain btn-sm"
                @click="removeFeature(feature)"
              >
                移除
              </button>
              <button v-else class="btn btn-primary btn-sm" @click="addFeature(feature)">
                <Icon name="plus" :size="12" />添加
              </button>
              <button
                v-if="isEnabled(feature)"
                class="icon-btn"
                title="打开"
                @click="openFeature(feature)"
              >
                <Icon name="arrowRight" :size="13" />
              </button>
            </template>
          </div>
        </div>
      </div>
    </section>
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

.summary-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.sc-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.sc-title {
  font-size: 13.5px;
  font-weight: 700;
}

.sc-desc {
  font-size: 11.5px;
  color: var(--text-3);
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.feature-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--surface-soft);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.feature-card.enabled {
  border-color: var(--green-200);
  background: var(--green-50);
}

.feature-card:hover {
  box-shadow: var(--shadow-card);
}

.fc-icon {
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: 10px;
  background: var(--green-100);
  color: var(--green-700);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.fc-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.fc-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
}

.fc-desc {
  font-size: 11.5px;
  color: var(--text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fc-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
}

@media (max-width: 1160px) {
  .feature-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>