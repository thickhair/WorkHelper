<script setup lang="ts">
/**
 * 新闻资讯页：本地资讯条目管理（新增 / 编辑 / 收藏 / 搜索 / 打开链接）。
 */
import { onMounted, reactive, ref } from 'vue'
import type { NewsItem } from '@shared/types'
import { useToastStore } from '../stores/toast'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import Icon from '../components/Icon.vue'
import ModalDialog from '../components/ModalDialog.vue'

const toast = useToastStore()

const items = ref<NewsItem[]>([])
const keyword = ref('')
const favoriteOnly = ref(false)
const loading = ref(false)

async function load(): Promise<void> {
  loading.value = true
  try {
    items.value = await window.api.news.list(keyword.value, favoriteOnly.value)
  } catch (err) {
    toast.error((err as Error).message)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
})

/* ------------------------------ 编辑弹窗 ------------------------------ */

const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const form = reactive({ title: '', source: '', url: '', summary: '', tags: '' })
const formError = ref('')

function openDialog(item?: NewsItem): void {
  formError.value = ''
  if (item) {
    editingId.value = item.id
    form.title = item.title
    form.source = item.source
    form.url = item.url
    form.summary = item.summary
    form.tags = item.tags
  } else {
    editingId.value = null
    form.title = ''
    form.source = ''
    form.url = ''
    form.summary = ''
    form.tags = ''
  }
  dialogVisible.value = true
}

async function save(): Promise<void> {
  if (!form.title.trim()) {
    formError.value = '请填写资讯标题'
    return
  }
  try {
    const payload = {
      title: form.title.trim(),
      source: form.source.trim(),
      url: form.url.trim(),
      summary: form.summary.trim(),
      tags: form.tags.trim(),
      favorite: false
    }
    if (editingId.value) {
      await window.api.news.update(editingId.value, payload)
    } else {
      await window.api.news.create(payload)
    }
    dialogVisible.value = false
    await load()
    toast.success('已保存')
  } catch (err) {
    toast.error((err as Error).message)
  }
}

async function toggleFavorite(item: NewsItem): Promise<void> {
  try {
    await window.api.news.toggleFavorite(item.id)
    await load()
  } catch (err) {
    toast.error((err as Error).message)
  }
}

async function openLink(item: NewsItem): Promise<void> {
  if (!item.url) {
    toast.push('该资讯没有填写链接', 'info')
    return
  }
  await window.api.app.openExternal(item.url)
}

/* ------------------------------ 删除确认 ------------------------------ */

const confirmState = ref<{ visible: boolean; message: string; action: (() => Promise<void>) | null }>({
  visible: false,
  message: '',
  action: null
})

async function runConfirm(): Promise<void> {
  const action = confirmState.value.action
  confirmState.value.visible = false
  if (!action) return
  try {
    await action()
    await load()
    toast.success('已删除')
  } catch (err) {
    toast.error((err as Error).message)
  }
}

function tagList(tags: string): string[] {
  return tags
    .split(/[,，\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)
}

/** 请求删除资讯 */
function askRemoveNews(item: NewsItem): void {
  confirmState.value = {
    visible: true,
    message: `确定删除资讯「${item.title}」吗？`,
    action: async () => {
      await window.api.news.remove(item.id)
    }
  }
}
</script>

<template>
  <div class="page">
    <header class="page-head">
      <div class="head-left">
        <span class="head-icon"><Icon name="news" :size="17" /></span>
        <div class="head-text">
          <h1>新闻资讯</h1>
          <p>收集值得关注的资讯，随时回看</p>
        </div>
      </div>

      <div class="head-tools">
        <div class="search-box">
          <Icon name="search" :size="14" />
          <input
            v-model="keyword"
            class="search-input"
            placeholder="搜索标题 / 来源 / 标签"
            @keyup.enter="load"
          />
        </div>
        <button
          class="btn btn-sm"
          :class="favoriteOnly ? 'btn-primary' : 'btn-plain'"
          @click="
            favoriteOnly = !favoriteOnly;
            load()
          "
        >
          <Icon name="star" :size="12" />仅看收藏
        </button>
        <button class="btn btn-primary btn-sm" @click="openDialog()">
          <Icon name="plus" :size="12" />添加资讯
        </button>
      </div>
    </header>

    <div v-if="!loading && items.length === 0" class="card empty-card">
      <div class="empty">
        <Icon name="news" :size="30" />
        <span>{{ keyword || favoriteOnly ? '没有匹配的资讯' : '还没有资讯，点击「添加资讯」收集第一条' }}</span>
      </div>
    </div>

    <section v-else class="news-grid">
      <article v-for="item in items" :key="item.id" class="news-card card">
        <div class="news-head">
          <h3 class="news-title" :title="item.title" @click="openLink(item)">{{ item.title }}</h3>
          <button
            class="icon-btn star"
            :class="{ on: item.favorite }"
            :title="item.favorite ? '取消收藏' : '收藏'"
            @click="toggleFavorite(item)"
          >
            <Icon name="star" :size="14" />
          </button>
        </div>

        <div class="news-meta">
          <span v-if="item.source" class="tag tag-blue">{{ item.source }}</span>
          <span v-for="tag in tagList(item.tags)" :key="tag" class="tag tag-plain">{{ tag }}</span>
          <span class="news-date">{{ item.createdAt.slice(0, 10) }}</span>
        </div>

        <p class="news-summary">{{ item.summary || '（暂无摘要）' }}</p>

        <div class="news-foot">
          <button class="btn btn-ghost btn-sm" @click="openLink(item)">
            <Icon name="arrowRight" :size="12" />打开链接
          </button>
          <div class="news-ops">
            <button class="icon-btn" title="编辑" @click="openDialog(item)">
              <Icon name="edit" :size="13" />
            </button>
            <button
              class="icon-btn danger"
              title="删除"
              @click="askRemoveNews(item)"
            >
              <Icon name="trash" :size="13" />
            </button>
          </div>
        </div>
      </article>
    </section>

    <!-- 编辑弹窗 -->
    <ModalDialog
      :visible="dialogVisible"
      :title="editingId ? '编辑资讯' : '添加资讯'"
      width="500px"
      @close="dialogVisible = false"
    >
      <div class="field">
        <label class="field-label">标题</label>
        <input v-model="form.title" class="input" placeholder="资讯标题" @keyup.enter="save" />
      </div>
      <div class="field-row">
        <div class="field">
          <label class="field-label">来源</label>
          <input v-model="form.source" class="input" placeholder="如：36氪 / 少数派" />
        </div>
        <div class="field">
          <label class="field-label">标签（空格或逗号分隔）</label>
          <input v-model="form.tags" class="input" placeholder="如：效率 工具" />
        </div>
      </div>
      <div class="field">
        <label class="field-label">链接</label>
        <input v-model="form.url" class="input" placeholder="https://" />
      </div>
      <div class="field">
        <label class="field-label">摘要</label>
        <textarea v-model="form.summary" class="textarea" placeholder="选填，记录核心观点"></textarea>
      </div>
      <p v-if="formError" class="form-error">
        <Icon name="info" :size="13" />{{ formError }}
      </p>
      <template #footer>
        <button class="btn btn-plain" @click="dialogVisible = false">取消</button>
        <button class="btn btn-primary" @click="save">
          <Icon name="check" :size="13" />保存
        </button>
      </template>
    </ModalDialog>

    <ConfirmDialog
      :visible="confirmState.visible"
      :message="confirmState.message"
      @close="confirmState.visible = false"
      @confirm="runConfirm"
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
  gap: 12px;
  flex-wrap: wrap;
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

.head-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: var(--surface);
  box-shadow: var(--shadow-card);
  color: var(--text-3);
  width: 240px;
}

.search-input {
  border: none;
  outline: none;
  background: transparent;
  font-size: 12.5px;
  flex: 1;
  color: var(--text-1);
}

.empty-card {
  padding: 40px 0;
}

.news-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(320px, 100%), 1fr));
  gap: 14px;
}

/* 窄窗口（≤700px）：搜索框占满整行，工具按钮自动换行 */
@media (max-width: 700px) {
  .search-box {
    width: 100%;
  }
}

.news-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: transform 0.15s, box-shadow 0.15s;
}

.news-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(31, 84, 49, 0.1);
}

.news-head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.news-title {
  flex: 1;
  font-size: 13.5px;
  font-weight: 700;
  line-height: 1.5;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.news-title:hover {
  color: var(--green-600);
}

.icon-btn.star.on {
  color: var(--yellow);
}

.news-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}

.news-date {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-3);
}

.news-summary {
  font-size: 12.5px;
  color: var(--text-2);
  line-height: 1.7;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  min-height: 48px;
}

.news-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 2px;
}

.news-ops {
  display: flex;
  gap: 2px;
}

.form-error {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--red);
  font-size: 12px;
}
</style>