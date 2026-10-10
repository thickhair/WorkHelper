<script setup lang="ts">
/**
 * 阅读面板 - 书签：添加当前页书签、列表跳转与删除。
 */
import type { Bookmark } from '@shared/types'
import Icon from '../Icon.vue'

defineProps<{ bookmarks: Bookmark[] }>()

const emit = defineEmits<{
  (e: 'add'): void
  (e: 'jump', bookmark: Bookmark): void
  (e: 'remove', bookmark: Bookmark): void
  (e: 'close'): void
}>()
</script>

<template>
  <div class="panel-inner">
    <div class="panel-head">
      <span class="panel-title"><Icon name="bookmark" :size="14" />书签</span>
      <button class="icon-btn" title="关闭" @click="emit('close')">
        <Icon name="close" :size="13" />
      </button>
    </div>
    <div class="panel-actions">
      <button class="btn btn-primary btn-sm add-btn" @click="emit('add')">
        <Icon name="plus" :size="12" />添加当前页书签
      </button>
    </div>
    <div class="panel-body">
      <p v-if="bookmarks.length === 0" class="bm-empty">
        还没有书签，翻到想记住的位置点击「添加当前页书签」
      </p>
      <div
        v-for="bookmark in bookmarks"
        :key="bookmark.id"
        class="bm-row"
        @click="emit('jump', bookmark)"
      >
        <div class="bm-text">
          <span class="bm-label">{{ bookmark.label }}</span>
          <span class="bm-sub">{{ bookmark.percent }}% · {{ bookmark.createdAt.slice(0, 16) }}</span>
        </div>
        <button class="icon-btn danger" title="删除书签" @click.stop="emit('remove', bookmark)">
          <Icon name="trash" :size="13" />
        </button>
      </div>
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

.panel-actions {
  flex: none;
  padding: 10px 12px 0;
}

.add-btn {
  width: 100%;
  justify-content: center;
}

.panel-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bm-empty {
  font-size: 11.5px;
  color: var(--text-3);
  line-height: 1.7;
  padding: 10px 2px;
}

.bm-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-soft);
  cursor: pointer;
  transition:
    border-color var(--dur-1) var(--ease-std),
    background var(--dur-1) var(--ease-std);
}

.bm-row:hover {
  border-color: var(--border-strong);
  background: var(--card);
}

.bm-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.bm-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bm-sub {
  font-size: 10.5px;
  color: var(--text-3);
}
</style>