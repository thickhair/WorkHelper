<script setup lang="ts">
/**
 * 工作复盘页：按日期记录「今日完成 / 问题与反思 / 明日计划 / 心情」。
 */
import { onMounted, reactive, ref } from 'vue'
import type { Review } from '@shared/types'
import { formatDate, monthDayLabel, weekdayLabel } from '@shared/logic'
import { useToastStore } from '../stores/toast'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import Icon from '../components/Icon.vue'
import ModalDialog from '../components/ModalDialog.vue'

const toast = useToastStore()

const reviews = ref<Review[]>([])
const today = formatDate(new Date())

/** 心情档位 */
const MOODS = [
  { value: 1, emoji: '😞', label: '有点低落' },
  { value: 2, emoji: '😐', label: '平平淡淡' },
  { value: 3, emoji: '🙂', label: '还不错' },
  { value: 4, emoji: '😃', label: '充实愉快' },
  { value: 5, emoji: '🤩', label: '超级棒' }
]

function moodOf(value: number): { emoji: string; label: string } {
  return MOODS.find((m) => m.value === value) ?? MOODS[2]
}

async function load(): Promise<void> {
  try {
    reviews.value = await window.api.reviews.list()
  } catch (err) {
    toast.error((err as Error).message)
  }
}

onMounted(() => {
  void load()
})

/* ------------------------------ 编辑弹窗 ------------------------------ */

const dialogVisible = ref(false)
const form = reactive({
  date: today,
  doneText: '',
  problemText: '',
  planText: '',
  mood: 3
})

function openDialog(review?: Review): void {
  if (review) {
    form.date = review.date
    form.doneText = review.doneText
    form.problemText = review.problemText
    form.planText = review.planText
    form.mood = review.mood
  } else {
    form.date = today
    form.doneText = ''
    form.problemText = ''
    form.planText = ''
    form.mood = 3
  }
  dialogVisible.value = true
}

async function save(): Promise<void> {
  if (!form.doneText.trim() && !form.problemText.trim() && !form.planText.trim()) {
    toast.error('请至少填写一项复盘内容')
    return
  }
  try {
    await window.api.reviews.save({
      date: form.date,
      doneText: form.doneText,
      problemText: form.problemText,
      planText: form.planText,
      mood: form.mood
    })
    dialogVisible.value = false
    await load()
    toast.success('复盘已保存')
  } catch (err) {
    toast.error((err as Error).message)
  }
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

function existToday(): boolean {
  return reviews.value.some((r) => r.date === today)
}

/** 请求删除某日复盘 */
function askRemoveReview(item: Review): void {
  confirmState.value = {
    visible: true,
    message: `确定删除 ${item.date} 的复盘吗？`,
    action: async () => {
      await window.api.reviews.remove(item.date)
    }
  }
}
</script>

<template>
  <div class="page">
    <header class="page-head">
      <div class="head-left">
        <span class="head-icon"><Icon name="notebook" :size="17" /></span>
        <div class="head-text">
          <h1>工作复盘</h1>
          <p>回顾每一天，让成长有迹可循</p>
        </div>
      </div>
      <button class="btn btn-primary btn-sm" @click="openDialog()">
        <Icon name="plus" :size="12" />{{ existToday() ? '编辑今日复盘' : '写今日复盘' }}
      </button>
    </header>

    <div v-if="reviews.length === 0" class="card">
      <div class="empty">
        <Icon name="notebook" :size="30" />
        <span>还没有复盘记录，点击「写今日复盘」开始</span>
      </div>
    </div>

    <section v-else class="review-list">
      <article v-for="item in reviews" :key="item.id" class="card review-card">
        <div class="review-head">
          <div class="review-date">
            <span class="rd-day">{{ monthDayLabel(item.date) }}</span>
            <span class="rd-week">{{ weekdayLabel(item.date) }}</span>
            <span v-if="item.date === today" class="tag">今天</span>
          </div>
          <div class="review-mood" :title="moodOf(item.mood).label">
            <span class="mood-emoji">{{ moodOf(item.mood).emoji }}</span>
            <span class="mood-label">{{ moodOf(item.mood).label }}</span>
          </div>
          <div class="review-ops">
            <button class="icon-btn" title="编辑" @click="openDialog(item)">
              <Icon name="edit" :size="13" />
            </button>
            <button
              class="icon-btn danger"
              title="删除"
              @click="askRemoveReview(item)"
            >
              <Icon name="trash" :size="13" />
            </button>
          </div>
        </div>

        <div class="review-sections">
          <div class="review-section">
            <span class="rs-title done"><Icon name="check" :size="12" />今日完成</span>
            <p class="rs-text">{{ item.doneText || '—' }}</p>
          </div>
          <div class="review-section">
            <span class="rs-title problem"><Icon name="info" :size="12" />问题与反思</span>
            <p class="rs-text">{{ item.problemText || '—' }}</p>
          </div>
          <div class="review-section">
            <span class="rs-title plan"><Icon name="target" :size="12" />明日计划</span>
            <p class="rs-text">{{ item.planText || '—' }}</p>
          </div>
        </div>
      </article>
    </section>

    <!-- 编辑弹窗 -->
    <ModalDialog
      :visible="dialogVisible"
      title="每日复盘"
      width="560px"
      @close="dialogVisible = false"
    >
      <div class="field-row">
        <div class="field">
          <label class="field-label">日期</label>
          <input v-model="form.date" class="input" type="date" />
        </div>
        <div class="field">
          <label class="field-label">今日心情</label>
          <div class="mood-picks">
            <button
              v-for="mood in MOODS"
              :key="mood.value"
              type="button"
              class="mood-pick"
              :class="{ active: form.mood === mood.value }"
              :title="mood.label"
              @click="form.mood = mood.value"
            >
              {{ mood.emoji }}
            </button>
          </div>
        </div>
      </div>

      <div class="field">
        <label class="field-label">今日完成</label>
        <textarea v-model="form.doneText" class="textarea" placeholder="今天完成了哪些事情？"></textarea>
      </div>
      <div class="field">
        <label class="field-label">问题与反思</label>
        <textarea v-model="form.problemText" class="textarea" placeholder="遇到了什么问题？有什么可以改进？"></textarea>
      </div>
      <div class="field">
        <label class="field-label">明日计划</label>
        <textarea v-model="form.planText" class="textarea" placeholder="明天最重要的三件事是什么？"></textarea>
      </div>

      <template #footer>
        <button class="btn btn-plain" @click="dialogVisible = false">取消</button>
        <button class="btn btn-primary" @click="save">
          <Icon name="check" :size="13" />保存复盘
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

.review-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(400px, 100%), 1fr));
  gap: 14px;
  align-items: start;
}

.review-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.review-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.review-date {
  display: flex;
  align-items: center;
  gap: 7px;
}

.rd-day {
  font-size: 14.5px;
  font-weight: 800;
  color: var(--green-800);
}

.rd-week {
  font-size: 12px;
  color: var(--text-3);
}

.review-mood {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-left: auto;
  background: var(--green-50);
  border-radius: 999px;
  padding: 3px 10px;
}

.mood-emoji {
  font-size: 15px;
}

.mood-label {
  font-size: 11.5px;
  color: var(--text-2);
}

.review-ops {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}

.review-card:hover .review-ops {
  opacity: 1;
}

.review-sections {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: 1px dashed var(--border);
  padding-top: 10px;
}

.review-section {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.rs-title {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  font-weight: 700;
}

.rs-title.done {
  color: var(--green-700);
}

.rs-title.problem {
  color: var(--yellow-ink);
}

.rs-title.plan {
  color: var(--blue-ink);
}

.rs-text {
  font-size: 12.5px;
  color: var(--text-2);
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.mood-picks {
  display: flex;
  gap: 6px;
}

.mood-pick {
  width: 34px;
  height: 34px;
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  background: var(--surface);
  font-size: 17px;
  cursor: pointer;
  transition: all 0.15s;
}

.mood-pick:hover {
  border-color: var(--green-400);
}

.mood-pick.active {
  border-color: var(--green-500);
  background: var(--green-50);
  transform: scale(1.06);
}
</style>