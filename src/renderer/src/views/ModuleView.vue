<script setup lang="ts">
/**
 * 分类模块工作区（减肥运动 / 英语学习 / 剪辑学习等 9 个模块共用）：
 * 模块目标、投入记录与模块笔记管理。
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { ModuleNote, ModuleRecord } from '@shared/types'
import { formatDate, formatMinutes } from '@shared/logic'
import { useAppStore } from '../stores/app'
import { useToastStore } from '../stores/toast'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import Icon from '../components/Icon.vue'
import ModalDialog from '../components/ModalDialog.vue'

const route = useRoute()
const appStore = useAppStore()
const toast = useToastStore()

const moduleKey = computed(() => String(route.params.key ?? ''))
const moduleInfo = computed(() => appStore.moduleMap[moduleKey.value] ?? null)

const records = ref<ModuleRecord[]>([])
const notes = ref<ModuleNote[]>([])
const summary = ref({ records: 0, minutes: 0, lastDate: '' })

async function loadAll(): Promise<void> {
  if (!moduleInfo.value) return
  try {
    const [recordList, noteList, sum] = await Promise.all([
      window.api.modules.records(moduleKey.value),
      window.api.modules.notes(moduleKey.value),
      window.api.modules.summary(moduleKey.value)
    ])
    records.value = recordList
    notes.value = noteList
    summary.value = sum
  } catch (err) {
    toast.error((err as Error).message)
  }
}

onMounted(async () => {
  if (!appStore.ready) await appStore.init()
  await loadAll()
})

watch(moduleKey, () => {
  void loadAll()
})

/* ------------------------------ 模块目标 ------------------------------ */

const goalEditing = ref(false)
const goalDraft = ref('')

function startEditGoal(): void {
  goalDraft.value = moduleInfo.value?.goal ?? ''
  goalEditing.value = true
}

async function saveGoal(): Promise<void> {
  try {
    await window.api.modules.updateGoal(moduleKey.value, goalDraft.value.trim())
    await appStore.refreshModules()
    goalEditing.value = false
    toast.success('目标已更新')
  } catch (err) {
    toast.error((err as Error).message)
  }
}

/* ------------------------------ 投入记录 ------------------------------ */

const recordDialog = ref(false)
const editingRecordId = ref<number | null>(null)
const recordForm = reactive({ date: formatDate(new Date()), title: '', duration: 30, note: '' })
const recordError = ref('')

function openRecordDialog(record?: ModuleRecord): void {
  recordError.value = ''
  if (record) {
    editingRecordId.value = record.id
    recordForm.date = record.date
    recordForm.title = record.title
    recordForm.duration = record.duration
    recordForm.note = record.note
  } else {
    editingRecordId.value = null
    recordForm.date = formatDate(new Date())
    recordForm.title = ''
    recordForm.duration = 30
    recordForm.note = ''
  }
  recordDialog.value = true
}

async function saveRecord(): Promise<void> {
  if (!recordForm.title.trim()) {
    recordError.value = '请填写记录内容'
    return
  }
  try {
    const payload = {
      moduleKey: moduleKey.value,
      date: recordForm.date,
      title: recordForm.title.trim(),
      duration: Math.max(0, Number(recordForm.duration) || 0),
      note: recordForm.note
    }
    if (editingRecordId.value) await window.api.modules.updateRecord(editingRecordId.value, payload)
    else await window.api.modules.createRecord(payload)
    recordDialog.value = false
    await loadAll()
    toast.success('已保存')
  } catch (err) {
    toast.error((err as Error).message)
  }
}

/* ------------------------------ 模块笔记 ------------------------------ */

const noteDialog = ref(false)
const editingNoteId = ref<number | null>(null)
const noteForm = reactive({ title: '', content: '' })
const noteError = ref('')
const openedNote = ref<ModuleNote | null>(null)

function openNoteDialog(note?: ModuleNote): void {
  noteError.value = ''
  if (note) {
    editingNoteId.value = note.id
    noteForm.title = note.title
    noteForm.content = note.content
  } else {
    editingNoteId.value = null
    noteForm.title = ''
    noteForm.content = ''
  }
  noteDialog.value = true
}

async function saveNote(): Promise<void> {
  if (!noteForm.title.trim()) {
    noteError.value = '请填写笔记标题'
    return
  }
  try {
    const payload = {
      moduleKey: moduleKey.value,
      title: noteForm.title.trim(),
      content: noteForm.content
    }
    if (editingNoteId.value) await window.api.modules.updateNote(editingNoteId.value, payload)
    else await window.api.modules.createNote(payload)
    noteDialog.value = false
    await loadAll()
    toast.success('已保存')
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

function askRemove(message: string, action: () => Promise<void>): void {
  confirmState.value = { visible: true, message, action }
}

async function runConfirm(): Promise<void> {
  const action = confirmState.value.action
  confirmState.value.visible = false
  if (!action) return
  try {
    await action()
    await loadAll()
    toast.success('已删除')
  } catch (err) {
    toast.error((err as Error).message)
  }
}

/** 请求删除投入记录 */
function askRemoveRecord(record: ModuleRecord): void {
  askRemove(`确定删除记录「${record.title}」吗？`, async () => {
    await window.api.modules.removeRecord(record.id)
  })
}

/** 请求删除模块笔记 */
function askRemoveNote(note: ModuleNote): void {
  askRemove(`确定删除笔记「${note.title}」吗？`, async () => {
    await window.api.modules.removeNote(note.id)
  })
}

/** 从笔记阅读态进入编辑态 */
function editOpenedNote(): void {
  const note = openedNote.value
  openedNote.value = null
  if (note) openNoteDialog(note)
}
</script>

<template>
  <div v-if="moduleInfo" class="page">
    <!-- 页头 -->
    <header class="page-head">
      <div class="head-left">
        <span class="head-icon">{{ moduleInfo.icon }}</span>
        <div class="head-text">
          <h1>{{ moduleInfo.name }}</h1>
          <p v-if="!goalEditing" class="goal-line">
            {{ moduleInfo.goal || '尚未设置模块目标' }}
            <button class="goal-edit" title="编辑目标" @click="startEditGoal">
              <Icon name="edit" :size="12" />
            </button>
          </p>
          <div v-else class="goal-editor">
            <input
              v-model="goalDraft"
              class="input goal-input"
              placeholder="输入本模块目标，如：每周运动 5 次"
              @keyup.enter="saveGoal"
            />
            <button class="btn btn-primary btn-sm" @click="saveGoal">保存</button>
            <button class="btn btn-plain btn-sm" @click="goalEditing = false">取消</button>
          </div>
        </div>
      </div>
    </header>

    <!-- 概览卡片 -->
    <section class="overview-row">
      <div class="overview-card">
        <span class="ov-icon">📌</span>
        <div class="ov-body">
          <span class="ov-value">{{ summary.records }}</span>
          <span class="ov-label">累计投入次数</span>
        </div>
      </div>
      <div class="overview-card yellow">
        <span class="ov-icon">⏳</span>
        <div class="ov-body">
          <span class="ov-value">{{ formatMinutes(summary.minutes) }}</span>
          <span class="ov-label">累计投入时长</span>
        </div>
      </div>
      <div class="overview-card blue">
        <span class="ov-icon">🗓️</span>
        <div class="ov-body">
          <span class="ov-value">{{ summary.lastDate || '—' }}</span>
          <span class="ov-label">最近记录日期</span>
        </div>
      </div>
    </section>

    <!-- 双栏内容 -->
    <section class="module-grid">
      <!-- 投入记录 -->
      <div class="card">
        <div class="card-header">
          <span class="card-title"><Icon name="clock" :size="15" />投入记录</span>
          <span class="card-sub">· {{ records.length }} 条</span>
          <button class="card-action" @click="openRecordDialog()">
            <Icon name="plus" :size="12" />新增记录
          </button>
        </div>

        <div v-if="records.length === 0" class="empty">
          <Icon name="clock" :size="26" />
          <span>还没有投入记录，点击「新增记录」开始积累</span>
        </div>

        <div v-else class="record-list">
          <div v-for="item in records" :key="item.id" class="record-item">
            <div class="record-main">
              <span class="record-title">{{ item.title }}</span>
              <span class="record-meta">
                {{ item.date }}
                <template v-if="item.duration > 0"> · {{ formatMinutes(item.duration) }}</template>
              </span>
              <p v-if="item.note" class="record-note">{{ item.note }}</p>
            </div>
            <div class="record-actions">
              <button class="icon-btn" title="编辑" @click="openRecordDialog(item)">
                <Icon name="edit" :size="13" />
              </button>
              <button
                class="icon-btn danger"
                title="删除"
                @click="askRemoveRecord(item)"
              >
                <Icon name="trash" :size="13" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 模块笔记 -->
      <div class="card">
        <div class="card-header">
          <span class="card-title"><Icon name="notebook" :size="15" />模块笔记</span>
          <span class="card-sub">· {{ notes.length }} 篇</span>
          <button class="card-action" @click="openNoteDialog()">
            <Icon name="plus" :size="12" />写笔记
          </button>
        </div>

        <div v-if="notes.length === 0" class="empty">
          <Icon name="notebook" :size="26" />
          <span>还没有笔记，记录你的学习心得吧</span>
        </div>

        <div v-else class="note-list">
          <div v-for="item in notes" :key="item.id" class="note-item" @click="openedNote = item">
            <div class="note-main">
              <span class="note-title">{{ item.title }}</span>
              <span class="note-preview">{{ item.content || '（空笔记）' }}</span>
              <span class="note-time">更新于 {{ item.updatedAt }}</span>
            </div>
            <div class="note-actions" @click.stop>
              <button class="icon-btn" title="编辑" @click="openNoteDialog(item)">
                <Icon name="edit" :size="13" />
              </button>
              <button
                class="icon-btn danger"
                title="删除"
                @click="askRemoveNote(item)"
              >
                <Icon name="trash" :size="13" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 记录编辑弹窗 -->
    <ModalDialog
      :visible="recordDialog"
      :title="editingRecordId ? '编辑投入记录' : '新增投入记录'"
      @close="recordDialog = false"
    >
      <div class="field">
        <label class="field-label">记录内容</label>
        <input
          v-model="recordForm.title"
          class="input"
          placeholder="如：有氧运动 30 分钟 / 背单词 50 个"
          @keyup.enter="saveRecord"
        />
      </div>
      <div class="field-row">
        <div class="field">
          <label class="field-label">日期</label>
          <input v-model="recordForm.date" class="input" type="date" />
        </div>
        <div class="field">
          <label class="field-label">投入时长（分钟）</label>
          <input v-model.number="recordForm.duration" class="input" type="number" min="0" step="5" />
        </div>
      </div>
      <div class="field">
        <label class="field-label">备注</label>
        <textarea v-model="recordForm.note" class="textarea" placeholder="选填，记录感受或细节"></textarea>
      </div>
      <p v-if="recordError" class="form-error">
        <Icon name="info" :size="13" />{{ recordError }}
      </p>
      <template #footer>
        <button class="btn btn-plain" @click="recordDialog = false">取消</button>
        <button class="btn btn-primary" @click="saveRecord">
          <Icon name="check" :size="13" />保存
        </button>
      </template>
    </ModalDialog>

    <!-- 笔记编辑弹窗 -->
    <ModalDialog
      :visible="noteDialog"
      :title="editingNoteId ? '编辑笔记' : '写笔记'"
      width="520px"
      @close="noteDialog = false"
    >
      <div class="field">
        <label class="field-label">标题</label>
        <input v-model="noteForm.title" class="input" placeholder="笔记标题" />
      </div>
      <div class="field">
        <label class="field-label">正文</label>
        <textarea
          v-model="noteForm.content"
          class="textarea note-textarea"
          placeholder="记录知识点、方法与心得……"
        ></textarea>
      </div>
      <p v-if="noteError" class="form-error">
        <Icon name="info" :size="13" />{{ noteError }}
      </p>
      <template #footer>
        <button class="btn btn-plain" @click="noteDialog = false">取消</button>
        <button class="btn btn-primary" @click="saveNote">
          <Icon name="check" :size="13" />保存
        </button>
      </template>
    </ModalDialog>

    <!-- 笔记阅读弹窗 -->
    <ModalDialog
      :visible="openedNote !== null"
      :title="openedNote?.title ?? ''"
      width="560px"
      @close="openedNote = null"
    >
      <p class="note-read">{{ openedNote?.content || '（空笔记）' }}</p>
      <p class="note-read-time">更新于 {{ openedNote?.updatedAt }}</p>
      <template #footer>
        <button class="btn btn-ghost" @click="editOpenedNote">
          <Icon name="edit" :size="13" />编辑
        </button>
        <button class="btn btn-primary" @click="openedNote = null">关闭</button>
      </template>
    </ModalDialog>

    <!-- 删除确认 -->
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
  min-width: 0;
}

.head-icon {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--green-500), var(--green-600));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  box-shadow: 0 4px 10px var(--brand-shadow);
  flex: none;
}

.head-text {
  min-width: 0;
}

.head-text h1 {
  font-size: 16px;
  font-weight: 800;
}

.goal-line {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: var(--text-3);
  margin-top: 2px;
}

.goal-edit {
  border: none;
  background: transparent;
  color: var(--green-600);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  padding: 2px;
}

.goal-editor {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}

.goal-input {
  width: 320px;
  height: 28px;
  padding: 0 10px;
}

/* ------------------------------ 概览卡片 ------------------------------ */
.overview-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.overview-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 14px;
  background: var(--green-100);
  border: 1px solid var(--brand-ring);
}

.overview-card.yellow {
  background: var(--yellow-soft);
  border-color: color-mix(in srgb, var(--yellow) 30%, transparent);
}

.overview-card.blue {
  background: var(--blue-soft);
  border-color: color-mix(in srgb, var(--blue) 30%, transparent);
}

.ov-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--surface);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  flex: none;
  box-shadow: 0 2px 6px var(--brand-ring);
}

.ov-body {
  display: flex;
  flex-direction: column;
}

.ov-value {
  font-size: 16px;
  font-weight: 800;
}

.ov-label {
  font-size: 11.5px;
  color: var(--text-2);
}

/* ------------------------------ 双栏内容 ------------------------------ */
.module-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.record-list,
.note-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.record-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--green-50);
  border: 1px solid var(--border);
  transition: border-color 0.15s;
}

.record-item:hover {
  border-color: var(--green-400);
}

.record-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.record-title {
  font-size: 13px;
  font-weight: 700;
}

.record-meta {
  font-size: 11.5px;
  color: var(--text-3);
}

.record-note {
  font-size: 12px;
  color: var(--text-2);
  margin-top: 2px;
  white-space: pre-wrap;
  word-break: break-word;
}

.record-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}

.record-item:hover .record-actions {
  opacity: 1;
}

.note-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  cursor: pointer;
  transition: all 0.15s;
}

.note-item:hover {
  border-color: var(--green-400);
  box-shadow: var(--shadow-card);
}

.note-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.note-title {
  font-size: 13px;
  font-weight: 700;
}

.note-preview {
  font-size: 12px;
  color: var(--text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.note-time {
  font-size: 11px;
  color: var(--text-3);
}

.note-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}

.note-item:hover .note-actions {
  opacity: 1;
}

.note-textarea {
  min-height: 160px;
}

.note-read {
  font-size: 13px;
  line-height: 1.8;
  color: var(--text-1);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 50vh;
  overflow: auto;
  padding-bottom: 8px;
}

.note-read-time {
  font-size: 11px;
  color: var(--text-3);
}

.form-error {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--red);
  font-size: 12px;
}

@media (max-width: 1160px) {
  .module-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>