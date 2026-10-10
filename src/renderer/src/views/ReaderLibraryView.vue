<script setup lang="ts">
/**
 * 阅读 - 书架：本地书籍的导入、网格展示（封面 / 进度）与移除。
 * 导入 EPUB / PDF 后在后台解析元数据（书名 / 作者 / 封面）并回写。
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { Book } from '@shared/types'
import Icon from '../components/Icon.vue'
import BookCard from '../components/reader/BookCard.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { useToastStore } from '../stores/toast'

const router = useRouter()
const toast = useToastStore()

const books = ref<Book[]>([])
const loading = ref(true)
const importing = ref(false)
const removeTarget = ref<Book | null>(null)

const removeMessage = computed(() =>
  removeTarget.value
    ? `确定移除「${removeTarget.value.title}」？书籍文件与书签将一并删除。`
    : ''
)

onMounted(() => {
  void load()
})

async function load(): Promise<void> {
  try {
    books.value = await window.api.books.list()
  } catch (err) {
    toast.error((err as Error).message)
  } finally {
    loading.value = false
  }
}

/** 导入书籍：主进程复制文件入库，渲染层随后解析元数据与封面 */
async function importBooks(): Promise<void> {
  if (importing.value) return
  importing.value = true
  try {
    const imported = await window.api.books.import()
    if (imported.length > 0) {
      toast.success(`已导入 ${imported.length} 本书`)
      await load()
      void enrichMeta(imported)
    }
  } catch (err) {
    toast.error((err as Error).message)
  } finally {
    importing.value = false
  }
}

/** 后台解析 EPUB / PDF 元数据与封面（失败静默，不影响导入结果） */
async function enrichMeta(targets: Book[]): Promise<void> {
  let updated = false
  for (const book of targets) {
    if (book.format !== 'epub' && book.format !== 'pdf') continue
    try {
      const data = await window.api.books.file(book.id)
      const { parseBookMeta } = await import('../reader/metadata')
      const patch = await parseBookMeta(book, data)
      if (patch && (patch.title || patch.author || patch.cover)) {
        await window.api.books.updateMeta(book.id, patch)
        updated = true
      }
    } catch (err) {
      console.warn('[reader] 元数据解析失败：', book.title, err)
    }
  }
  if (updated) await load()
}

function openBook(book: Book): void {
  void router.push(`/reader/book/${book.id}`)
}

function askRemove(book: Book): void {
  removeTarget.value = book
}

async function confirmRemove(): Promise<void> {
  const target = removeTarget.value
  removeTarget.value = null
  if (!target) return
  try {
    await window.api.books.remove(target.id)
    toast.push(`已移除「${target.title}」`, 'info')
    await load()
  } catch (err) {
    toast.error((err as Error).message)
  }
}
</script>

<template>
  <div class="page">
    <header class="page-head">
      <div class="head-left">
        <span class="head-icon"><Icon name="books" :size="17" /></span>
        <div class="head-text">
          <h1>阅读</h1>
          <p>本地电子书阅读：EPUB / PDF / TXT / Markdown</p>
        </div>
      </div>
      <button class="btn btn-primary" :disabled="importing" @click="importBooks">
        <Icon :name="importing ? 'refresh' : 'plus'" :size="13" />
        {{ importing ? '导入中…' : '导入书籍' }}
      </button>
    </header>

    <section v-if="loading" class="card">
      <p class="text-muted">正在加载书架…</p>
    </section>

    <section v-else-if="books.length === 0" class="card">
      <div class="empty">
        <span class="icon"><Icon name="books" :size="34" /></span>
        <p class="empty-title">书架还是空的</p>
        <p class="empty-desc">
          点击「导入书籍」选择本地文件（支持 EPUB / PDF / TXT / Markdown），<br />
          书籍会复制到工作台数据目录，移动原文件不影响阅读
        </p>
        <button class="btn btn-primary" :disabled="importing" @click="importBooks">
          <Icon name="plus" :size="13" />导入第一本书
        </button>
      </div>
    </section>

    <section v-else class="shelf">
      <BookCard
        v-for="book in books"
        :key="book.id"
        :book="book"
        @open="openBook(book)"
        @remove="askRemove(book)"
      />
    </section>

    <ConfirmDialog
      :visible="Boolean(removeTarget)"
      title="移除书籍"
      :message="removeMessage"
      confirm-text="移除"
      @close="removeTarget = null"
      @confirm="confirmRemove"
    />
  </div>
</template>

<style scoped>
.shelf {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: 18px 16px;
  align-items: start;
}

@media (max-width: 640px) {
  .shelf {
    grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
    gap: 14px 12px;
  }
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 26px 10px 30px;
  text-align: center;
}

.empty .icon {
  color: var(--text-3);
  margin-bottom: 2px;
}

.empty-title {
  font-size: 14px;
  font-weight: 800;
  color: var(--text-1);
}

.empty-desc {
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.8;
  margin-bottom: 8px;
}
</style>