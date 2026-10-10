<script setup lang="ts">
/**
 * 阅读面板 - 设置：阅读主题、字体、字号、行距与页边距。
 * 改动即时生效（emit update），由阅读页应用并持久化。
 * PDF 为固定版式，字体相关项禁用并给出提示。
 */
import { computed } from 'vue'
import {
  READER_FONTS,
  READER_FONT_SIZE_RANGE,
  READER_LINE_HEIGHT_RANGE,
  READER_MARGIN_RANGE,
  READER_THEMES,
  resolveReaderPalette,
  type ReaderSettings
} from '@shared/reader'
import type { BookFormat } from '@shared/types'
import Icon from '../Icon.vue'

const props = defineProps<{
  settings: ReaderSettings
  format?: BookFormat
}>()

const emit = defineEmits<{
  (e: 'update', settings: ReaderSettings): void
  (e: 'close'): void
}>()

/** PDF 为固定版式，字体 / 字号 / 行距 / 页边距不生效 */
const fixedLayout = computed(() => props.format === 'pdf')

/** 主题色块（浅色 / 羊皮纸 / 夜间取实际阅读配色；跟随应用用双色渐变示意） */
const themeSwatches: Record<string, string> = {
  auto: `linear-gradient(135deg, ${resolveReaderPalette('light', false).background} 0 50%, ${resolveReaderPalette('dark', false).background} 50% 100%)`,
  light: resolveReaderPalette('light', false).background,
  sepia: resolveReaderPalette('sepia', false).background,
  dark: resolveReaderPalette('dark', false).background
}

function update(patch: Partial<ReaderSettings>): void {
  emit('update', { ...props.settings, ...patch })
}

function stepValue(
  current: number,
  delta: number,
  range: { min: number; max: number; step: number }
): number {
  const next = Math.round((current + delta * range.step) * 10) / 10
  return Math.min(range.max, Math.max(range.min, next))
}
</script>

<template>
  <div class="panel-inner">
    <div class="panel-head">
      <span class="panel-title"><Icon name="type" :size="14" />阅读设置</span>
      <button class="icon-btn" title="关闭" @click="emit('close')">
        <Icon name="close" :size="13" />
      </button>
    </div>
    <div class="panel-body">
      <section class="setting-group">
        <span class="setting-label">阅读主题</span>
        <div class="theme-grid">
          <button
            v-for="theme in READER_THEMES"
            :key="theme.id"
            class="theme-item"
            :class="{ active: settings.theme === theme.id }"
            @click="update({ theme: theme.id })"
          >
            <span class="theme-swatch" :style="{ background: themeSwatches[theme.id] }"></span>
            {{ theme.name }}
          </button>
        </div>
      </section>

      <section class="setting-group">
        <span class="setting-label">字体</span>
        <div class="font-grid">
          <button
            v-for="font in READER_FONTS"
            :key="font.id"
            class="font-item"
            :class="{ active: settings.fontId === font.id }"
            :style="{ fontFamily: font.stack }"
            :disabled="fixedLayout"
            @click="update({ fontId: font.id })"
          >
            {{ font.name }}
          </button>
        </div>
      </section>

      <section class="setting-group">
        <span class="setting-label">字号</span>
        <div class="stepper">
          <button
            class="stepper-btn"
            :disabled="fixedLayout || settings.fontSize <= READER_FONT_SIZE_RANGE.min"
            @click="update({ fontSize: stepValue(settings.fontSize, -1, READER_FONT_SIZE_RANGE) })"
          >
            −
          </button>
          <span class="stepper-value">{{ settings.fontSize }} px</span>
          <button
            class="stepper-btn"
            :disabled="fixedLayout || settings.fontSize >= READER_FONT_SIZE_RANGE.max"
            @click="update({ fontSize: stepValue(settings.fontSize, 1, READER_FONT_SIZE_RANGE) })"
          >
            ＋
          </button>
        </div>
      </section>

      <section class="setting-group">
        <span class="setting-label">行距</span>
        <div class="stepper">
          <button
            class="stepper-btn"
            :disabled="fixedLayout || settings.lineHeight <= READER_LINE_HEIGHT_RANGE.min"
            @click="update({ lineHeight: stepValue(settings.lineHeight, -1, READER_LINE_HEIGHT_RANGE) })"
          >
            −
          </button>
          <span class="stepper-value">{{ settings.lineHeight.toFixed(1) }}</span>
          <button
            class="stepper-btn"
            :disabled="fixedLayout || settings.lineHeight >= READER_LINE_HEIGHT_RANGE.max"
            @click="update({ lineHeight: stepValue(settings.lineHeight, 1, READER_LINE_HEIGHT_RANGE) })"
          >
            ＋
          </button>
        </div>
      </section>

      <section class="setting-group">
        <span class="setting-label">页边距</span>
        <div class="stepper">
          <button
            class="stepper-btn"
            :disabled="fixedLayout || settings.margin <= READER_MARGIN_RANGE.min"
            @click="update({ margin: stepValue(settings.margin, -1, READER_MARGIN_RANGE) })"
          >
            −
          </button>
          <span class="stepper-value">{{ settings.margin }} px</span>
          <button
            class="stepper-btn"
            :disabled="fixedLayout || settings.margin >= READER_MARGIN_RANGE.max"
            @click="update({ margin: stepValue(settings.margin, 1, READER_MARGIN_RANGE) })"
          >
            ＋
          </button>
        </div>
      </section>

      <p v-if="fixedLayout" class="setting-hint">
        PDF 为固定版式，字体、字号与页边距等排版设置不生效，仅阅读主题影响背景配色
      </p>
    </div>
  </div>
</template>

<style scoped>
.panel-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.panel-head {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 12px 10px 14px;
  border-bottom: 1px solid var(--border);
}

.panel-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 800;
  color: var(--text-1);
}

.panel-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 13px 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-label {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--text-2);
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}

.theme-item {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 9px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-soft);
  font-size: 11.5px;
  color: var(--text-2);
  cursor: pointer;
  transition:
    border-color var(--dur-1) var(--ease-std),
    color var(--dur-1) var(--ease-std);
}

.theme-item:hover {
  border-color: var(--border-strong);
  color: var(--text-1);
}

.theme-item.active {
  border-color: var(--green-500);
  color: var(--green-700);
  font-weight: 700;
}

.theme-swatch {
  width: 16px;
  height: 16px;
  border-radius: 5px;
  border: 1px solid var(--border-strong);
  flex: none;
}

.font-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}

.font-item {
  padding: 7px 9px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-soft);
  font-size: 12px;
  color: var(--text-2);
  cursor: pointer;
  transition:
    border-color var(--dur-1) var(--ease-std),
    color var(--dur-1) var(--ease-std);
}

.font-item:hover:not(:disabled) {
  border-color: var(--border-strong);
  color: var(--text-1);
}

.font-item.active {
  border-color: var(--green-500);
  color: var(--green-700);
  font-weight: 700;
}

.font-item:disabled,
.theme-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.stepper {
  display: flex;
  align-items: center;
  gap: 10px;
}

.stepper-btn {
  width: 30px;
  height: 28px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-soft);
  color: var(--text-1);
  font-size: 14px;
  cursor: pointer;
  transition:
    background var(--dur-1) var(--ease-std),
    border-color var(--dur-1) var(--ease-std);
}

.stepper-btn:hover:not(:disabled) {
  background: var(--hover-tint);
  border-color: var(--border-strong);
}

.stepper-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.stepper-value {
  min-width: 58px;
  text-align: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-1);
}

.setting-hint {
  font-size: 11px;
  color: var(--text-3);
  line-height: 1.6;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: var(--plain-bg);
}
</style>