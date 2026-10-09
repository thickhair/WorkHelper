<script setup lang="ts">
/**
 * 功能广场：网格形式集中管理侧边栏功能（添加 / 移除 / 恢复默认），
 * 每个功能使用独立色调与徽章样式的图标，便于快速区分。
 * 首页 / 每日计划 / 日历 / 功能广场为固定项（不在此管理），设置入口位于窗口右上角。
 */
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  CONFIGURABLE_FEATURES,
  FEATURE_GROUP_LABELS,
  type FeatureDef,
  type FeatureGroup,
  type FeatureTone
} from '@shared/features'
import { useSidebarStore } from '../stores/sidebar'
import { useToastStore } from '../stores/toast'
import Icon from '../components/Icon.vue'

/** 分组展示顺序 */
const GROUP_ORDER: FeatureGroup[] = ['core', 'tool', 'system']

/** 分组色调（分组标题前的色块） */
const GROUP_TONES: Record<FeatureGroup, FeatureTone> = {
  core: 'green',
  tool: 'blue',
  system: 'slate'
}

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

/** 按分组组织的可配置功能列表 */
const groups = computed(() =>
  GROUP_ORDER.map((group) => ({
    group,
    label: FEATURE_GROUP_LABELS[group],
    features: CONFIGURABLE_FEATURES.filter((f) => f.group === group)
  })).filter((item) => item.features.length > 0)
)

/** 已添加到侧边栏的可配置功能数量（固定功能不参与配置） */
const enabledCount = computed(() => sidebar.enabled.length)

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

/** 恢复默认侧边栏配置（清空可配置功能，仅保留固定功能） */
async function restoreDefaults(): Promise<void> {
  try {
    await sidebar.restoreDefaults()
    toast.success('已恢复默认侧边栏（仅保留固定功能）')
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
        <span class="sc-title">已添加 {{ enabledCount }} / {{ CONFIGURABLE_FEATURES.length }} 项功能</span>
        <span class="sc-desc">
          首页、每日计划、日历、功能广场固定显示在侧边栏；移除功能只是从侧边栏隐藏，数据不会删除，可随时重新添加
        </span>
      </div>
      <button class="btn btn-ghost btn-sm" @click="restoreDefaults">
        <Icon name="restore" :size="12" />恢复默认
      </button>
    </section>

    <!-- 分组功能网格 -->
    <section v-for="group in groups" :key="group.group" class="card">
      <div class="card-header">
        <span class="card-title">
          <i class="group-dot" :class="`tone-${GROUP_TONES[group.group]}`"></i>
          {{ group.label }}
        </span>
        <span class="card-sub">{{ group.features.length }} 项</span>
      </div>

      <div class="feature-grid">
        <div
          v-for="feature in group.features"
          :key="feature.id"
          class="tile"
          :class="[`tone-${feature.tone}`, { enabled: isEnabled(feature) }]"
        >
          <div class="tile-head">
            <span class="tile-badge" :class="feature.style">
              <Icon :name="feature.icon" :size="20" />
            </span>
            <div class="tile-title-wrap">
              <span class="tile-name">{{ feature.name }}</span>
              <span class="tile-state" :class="{ on: isEnabled(feature) }">
                {{ isEnabled(feature) ? '已添加到侧边栏' : '未添加' }}
              </span>
            </div>
          </div>
          <p class="tile-desc">{{ feature.desc }}</p>
          <div class="tile-actions">
            <button v-if="isEnabled(feature)" class="btn btn-plain btn-sm" @click="removeFeature(feature)">
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

/* ------------------------------ 功能网格 ------------------------------ */
.group-dot {
  width: 9px;
  height: 9px;
  border-radius: 3px;
  background: var(--tone);
  display: inline-block;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(210px, 100%), 1fr));
  gap: 12px;
}

.tile {
  --tone: #4c9a62;
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 13px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-soft);
  transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s, background 0.15s;
}

.tile:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--tone) 38%, transparent);
  box-shadow: 0 10px 22px color-mix(in srgb, var(--tone) 16%, transparent);
}

.tile.enabled {
  border-color: color-mix(in srgb, var(--tone) 32%, transparent);
  background: color-mix(in srgb, var(--tone) 6%, var(--surface));
}

.tile-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tile-badge {
  width: 42px;
  height: 42px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 13px;
  transition: transform 0.18s;
}

.tile:hover .tile-badge {
  transform: scale(1.06) rotate(-3deg);
}

/* 实心渐变徽章 */
.tile-badge.solid {
  background: linear-gradient(140deg, color-mix(in srgb, var(--tone) 88%, #fff), var(--tone));
  color: #fff;
  box-shadow: 0 6px 14px color-mix(in srgb, var(--tone) 36%, transparent);
}

/* 柔和底色徽章 */
.tile-badge.soft {
  background: color-mix(in srgb, var(--tone) 16%, var(--surface));
  color: color-mix(in srgb, var(--tone) 88%, var(--text-1));
  border: 1px solid color-mix(in srgb, var(--tone) 26%, transparent);
}

/* 描边环徽章 */
.tile-badge.ring {
  background: var(--surface);
  color: color-mix(in srgb, var(--tone) 90%, var(--text-1));
  border: 1.5px solid color-mix(in srgb, var(--tone) 55%, transparent);
  box-shadow: inset 0 0 0 3px color-mix(in srgb, var(--tone) 12%, transparent);
}

.tile-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.tile-name {
  font-size: 13px;
  font-weight: 800;
  color: var(--text-1);
}

.tile-state {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--text-3);
}

.tile-state.on {
  color: color-mix(in srgb, var(--tone) 78%, var(--text-1));
}

.tile-desc {
  flex: 1;
  font-size: 11.5px;
  color: var(--text-3);
  line-height: 1.5;
}

.tile-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}

/* ------------------------------ 功能色调 ------------------------------ */
.tone-green {
  --tone: #4c9a62;
}

.tone-teal {
  --tone: #1fa08f;
}

.tone-blue {
  --tone: #4e93d4;
}

.tone-indigo {
  --tone: #6c7be0;
}

.tone-violet {
  --tone: #9a6be0;
}

.tone-pink {
  --tone: #e070a8;
}

.tone-rose {
  --tone: #e0695e;
}

.tone-orange {
  --tone: #ef8a3c;
}

.tone-amber {
  --tone: #d9a62b;
}

.tone-slate {
  --tone: #6e8078;
}

/* ------------------------------ 响应式 ------------------------------ */
@media (max-width: 560px) {
  .feature-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>