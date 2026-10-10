<script setup lang="ts">
/**
 * 习惯打卡面板（首页显著位置）：紧凑习惯列表 + 点击圆环快速打卡 + 撤销，
 * 并提供习惯的新增 / 编辑 / 删除管理入口。数据来自每日计划 store。
 */
import { ref } from 'vue'
import type { Habit } from '@shared/types'
import { usePlanStore } from '../stores/plan'
import { useToastStore } from '../stores/toast'
import ConfirmDialog from './ConfirmDialog.vue'
import HabitEditDialog from './HabitEditDialog.vue'
import Icon from './Icon.vue'
import ModalDialog from './ModalDialog.vue'
import ProgressRing from './ProgressRing.vue'

const store = usePlanStore()
const toast = useToastStore()

const managerVisible = ref(false)
const editVisible = ref(false)
const editingHabit = ref<Habit | null>(null)

function openEdit(habit: Habit | null): void {
  editingHabit.value = habit
  editVisible.value = true
}

async function saveHabit(value: { name: string; icon: string; target: number }): Promise<void> {
  try {
    if (editingHabit.value) await store.updateHabit(editingHabit.value.id, value)
    else await store.addHabit(value)
    editVisible.value = false
    toast.success('已保存')
  } catch (err) {
    toast.error((err as Error).message)
  }
}

/** 打卡（delta 为 +1）/ 撤销（-1） */
async function checkIn(id: number, delta: number): Promise<void> {
  try {
    await store.checkInHabit(id, delta)
  } catch (err) {
    toast.error((err as Error).message)
  }
}

/* ------------------------------ 删除确认 ------------------------------ */

const confirmVisible = ref(false)
const confirmMessage = ref('')
let confirmAction: (() => Promise<void>) | null = null

function askRemove(message: string, action: () => Promise<void>): void {
  confirmMessage.value = message
  confirmAction = action
  confirmVisible.value = true
}

async function runConfirm(): Promise<void> {
  const action = confirmAction
  confirmVisible.value = false
  confirmAction = null
  if (!action) return
  try {
    await action()
    toast.success('已删除')
  } catch (err) {
    toast.error((err as Error).message)
  }
}
</script>

<template>
  <div class="card">
    <div class="card-header">
      <span class="card-title"><Icon name="fire" :size="15" />习惯打卡</span>
      <span class="card-sub">点击圆环打卡</span>
      <button class="card-action" @click="managerVisible = true">
        <Icon name="settings" :size="12" />管理
      </button>
    </div>

    <div v-if="store.habits.length === 0" class="empty">
      <Icon name="fire" :size="26" />
      <span>还没有习惯，点击「管理」添加</span>
    </div>

    <div v-else class="habit-grid">
      <div v-for="habit in store.habits" :key="habit.id" class="habit-item">
        <ProgressRing
          :icon="habit.icon"
          :count="habit.count"
          :target="habit.target"
          @check="checkIn(habit.id, 1)"
        />
        <span class="habit-count">{{ habit.count }}/{{ habit.target }}</span>
        <span class="habit-name">{{ habit.name }}</span>
        <button
          v-if="habit.count > 0"
          class="habit-undo"
          title="撤销一次打卡"
          @click="checkIn(habit.id, -1)"
        >
          −
        </button>
      </div>
    </div>

    <!-- 弹窗：习惯管理 -->
    <ModalDialog
      :visible="managerVisible"
      title="管理习惯"
      width="420px"
      @close="managerVisible = false"
    >
      <div class="habit-manage-list">
        <div v-for="habit in store.habits" :key="habit.id" class="habit-manage-row">
          <span class="hm-icon">{{ habit.icon }}</span>
          <span class="hm-name">{{ habit.name }}</span>
          <span class="tag tag-plain">目标 {{ habit.target }} 次/天</span>
          <button class="icon-btn" title="编辑" @click="openEdit(habit)">
            <Icon name="edit" :size="13" />
          </button>
          <button
            class="icon-btn danger"
            title="删除"
            @click="
              askRemove(`确定删除习惯「${habit.name}」吗？历史打卡记录将一并删除。`, () =>
                store.removeHabit(habit.id)
              )
            "
          >
            <Icon name="trash" :size="13" />
          </button>
        </div>
        <div v-if="store.habits.length === 0" class="empty">
          <span>暂无习惯</span>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-ghost" @click="openEdit(null)">
          <Icon name="plus" :size="13" />新增习惯
        </button>
        <button class="btn btn-primary" @click="managerVisible = false">完成</button>
      </template>
    </ModalDialog>

    <!-- 弹窗：习惯编辑 -->
    <HabitEditDialog
      :visible="editVisible"
      :habit="editingHabit"
      @close="editVisible = false"
      @save="saveHabit"
    />

    <!-- 弹窗：删除确认 -->
    <ConfirmDialog
      :visible="confirmVisible"
      :message="confirmMessage"
      @close="confirmVisible = false"
      @confirm="runConfirm"
    />
  </div>
</template>

<style scoped>
.habit-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
  gap: 8px;
}

.habit-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 6px 2px;
  border-radius: 12px;
  transition: background var(--dur-1) var(--ease-std);
}

.habit-item:hover {
  background: var(--green-50);
}

.habit-count {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--green-700);
  font-variant-numeric: tabular-nums;
}

.habit-name {
  font-size: 11.5px;
  color: var(--text-2);
  white-space: nowrap;
}

.habit-undo {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: none;
  background: var(--surface);
  color: var(--text-3);
  box-shadow: 0 1px 4px rgba(31, 84, 49, 0.2);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
}

.habit-item:hover .habit-undo {
  opacity: 1;
}

.habit-undo:hover {
  color: var(--red);
}

/* ----------------------------- 管理弹窗 ----------------------------- */
.habit-manage-list {
  display: flex;
  flex-direction: column;
  max-height: 320px;
  overflow: auto;
}

.habit-manage-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 2px;
  border-bottom: 1px dashed var(--border);
}

.habit-manage-row:last-child {
  border-bottom: none;
}

.hm-icon {
  font-size: 16px;
}

.hm-name {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
}

@media (max-width: 560px) {
  .habit-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>