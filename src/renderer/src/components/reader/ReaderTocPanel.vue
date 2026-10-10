<script setup lang="ts">
/**
 * 阅读面板 - 目录（仅 EPUB）：按层级展示章节目录，点击跳转。
 */
import type { ReaderTocItem } from '../../reader'
import Icon from '../Icon.vue'

defineProps<{
  items: ReaderTocItem[]
  /** 当前章节名（与条目 label 一致时高亮） */
  activeLabel: string
}>()

const emit = defineEmits<{
  (e: 'select', item: ReaderTocItem): void
  (e: 'close'): void
}>()
</script>

<template>
  <div class="panel-inner">
    <div class="panel-head">
      <span class="panel-title"><Icon name="list" :size="14" />目录</span>
      <button class="icon-btn" title="关闭" @click="emit('close')">
        <Icon name="close" :size="13" />
      </button>
    </div>
    <div class="panel-body">
      <button
        v-for="item in items"
        :key="item.id"
        class="toc-item"
        :class="{ active: item.label === activeLabel }"
        :style="{ paddingLeft: `${12 + item.level * 14}px` }"
        @click="emit('select', item)"
      >
        {{ item.label }}
      </button>
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
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.toc-item {
  border: none;
  background: transparent;
  text-align: left;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 12px;
  color: var(--text-2);
  cursor: pointer;
  line-height: 1.5;
  transition:
    background var(--dur-1) var(--ease-std),
    color var(--dur-1) var(--ease-std);
}

.toc-item:hover {
  background: var(--hover-tint);
  color: var(--text-1);
}

.toc-item.active {
  background: var(--brand-ring);
  color: var(--green-700);
  font-weight: 700;
}
</style>