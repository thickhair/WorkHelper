<script setup lang="ts">
/**
 * 书架卡片：封面（解析成功显示图片，否则为按格式着色的默认封面）、
 * 书名、作者 / 格式 / 大小与阅读进度；悬停显示删除按钮。
 */
import { computed } from 'vue'
import type { Book } from '@shared/types'
import { READER_FORMAT_LABELS, formatFileSize } from '@shared/reader'
import Icon from '../Icon.vue'

const props = defineProps<{ book: Book }>()

const emit = defineEmits<{
  (e: 'open'): void
  (e: 'remove'): void
}>()

const formatLabel = computed(() => READER_FORMAT_LABELS[props.book.format])
const sizeLabel = computed(() => formatFileSize(props.book.fileSize))
const progressText = computed(() =>
  props.book.lastReadAt ? `已读 ${props.book.progress}%` : '未开始阅读'
)
</script>

<template>
  <div class="book-card" :class="`fmt-${book.format}`" @click="emit('open')">
    <div class="bc-cover">
      <img v-if="book.cover" :src="book.cover" :alt="book.title" loading="lazy" />
      <div v-else class="bc-default">
        <Icon name="book" :size="30" />
        <span class="bc-default-title">{{ book.title }}</span>
        <span class="bc-default-format">{{ formatLabel }}</span>
      </div>
      <span class="bc-format">{{ formatLabel }}</span>
      <button class="bc-remove" title="移除书籍" @click.stop="emit('remove')">
        <Icon name="trash" :size="13" />
      </button>
    </div>
    <div class="bc-info">
      <span class="bc-title" :title="book.title">{{ book.title }}</span>
      <span class="bc-meta">{{ book.author || '未知作者' }} · {{ sizeLabel }}</span>
      <div class="bc-progress">
        <div class="bc-bar"><i :style="{ width: `${book.progress}%` }"></i></div>
        <span class="bc-progress-text">{{ progressText }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.book-card {
  display: flex;
  flex-direction: column;
  gap: 9px;
  cursor: pointer;
}

.bc-cover {
  position: relative;
  aspect-ratio: 3 / 4;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--surface-soft);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-card);
  transition:
    transform var(--dur-2) var(--ease-std),
    box-shadow var(--dur-2) var(--ease-std);
}

.book-card:hover .bc-cover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-float);
}

.bc-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.bc-default {
  --cover-from: #4e93d4;
  --cover-to: #3a7cb5;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 14px;
  color: #fff;
  background: linear-gradient(150deg, var(--cover-from), var(--cover-to));
}

.fmt-epub .bc-default {
  --cover-from: #55a878;
  --cover-to: #3d8a5c;
}

.fmt-pdf .bc-default {
  --cover-from: #d97b6c;
  --cover-to: #bf5b4c;
}

.fmt-txt .bc-default {
  --cover-from: #7c8b9c;
  --cover-to: #5d6b7a;
}

.fmt-md .bc-default {
  --cover-from: #7f8ee0;
  --cover-to: #5f6fc4;
}

.bc-default-title {
  font-size: 12.5px;
  font-weight: 700;
  text-align: center;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.bc-default-format {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.22);
}

.bc-format {
  position: absolute;
  left: 8px;
  bottom: 8px;
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: #fff;
  background: rgba(20, 30, 24, 0.55);
  padding: 2px 7px;
  border-radius: 999px;
  backdrop-filter: blur(4px);
}

.bc-remove {
  position: absolute;
  top: 7px;
  right: 7px;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: rgba(20, 30, 24, 0.5);
  cursor: pointer;
  opacity: 0;
  transition:
    opacity var(--dur-1) var(--ease-std),
    background var(--dur-1) var(--ease-std);
}

.book-card:hover .bc-remove {
  opacity: 1;
}

.bc-remove:hover {
  background: #e8564a;
}

.bc-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.bc-title {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bc-meta {
  font-size: 10.5px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bc-progress {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 2px;
}

.bc-bar {
  flex: 1;
  height: 4px;
  border-radius: 999px;
  background: var(--plain-bg);
  overflow: hidden;
}

.bc-bar i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--green-600);
  transition: width var(--dur-2) var(--ease-std);
}

.bc-progress-text {
  font-size: 10px;
  color: var(--text-3);
  flex: none;
}
</style>