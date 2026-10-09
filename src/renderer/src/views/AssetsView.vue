<script setup lang="ts">
/**
 * 资产页：多平台账户管理、收支记录、资产分布与趋势图表、
 * 收支分类统计、攒钱计划与「想买」目标（含自动存款计划与进度）。
 * 图表为纯 SVG 自绘（无第三方依赖），数据均为手动维护口径。
 */
import { computed, onMounted, ref } from 'vue'
import {
  categoriesOf,
  formatMoney,
  formatMoneyShort,
  platformOf,
  ASSET_PLATFORMS,
  type AssetRecordKind
} from '@shared/assets'
import type {
  AssetAccount,
  AssetCategoryStat,
  AssetRecordInput,
  AssetRecordWithAccount,
  AssetsSummary,
  AssetTrendPoint,
  SavingGoalInput,
  SavingGoalWithProgress
} from '@shared/types'
import { formatDate } from '@shared/logic'
import { useToastStore } from '../stores/toast'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import Icon from '../components/Icon.vue'
import ModalDialog from '../components/ModalDialog.vue'
import PlatformIcon from '../components/PlatformIcon.vue'

const toast = useToastStore()
const today = formatDate(new Date())

/* ------------------------------ 数据状态 ------------------------------ */

const accounts = ref<AssetAccount[]>([])
const records = ref<AssetRecordWithAccount[]>([])
const summary = ref<AssetsSummary | null>(null)
const trend = ref<AssetTrendPoint[]>([])
const expenseStats = ref<AssetCategoryStat[]>([])
const incomeStats = ref<AssetCategoryStat[]>([])
const plans = ref<SavingGoalWithProgress[]>([])
const wishes = ref<SavingGoalWithProgress[]>([])

/** 金额显隐（默认隐藏） */
const showMoney = ref(false)

/** 记录筛选：月份（YYYY-MM）与类型 */
const filterMonth = ref(today.slice(0, 7))
const filterKind = ref<'' | AssetRecordKind>('')

async function loadAll(): Promise<void> {
  try {
    const [accountData, summaryData, trendData, expenseData, incomeData, planData, wishData] =
      await Promise.all([
        window.api.assets.accounts(),
        window.api.assets.summary(),
        window.api.assets.trend(30),
        window.api.assets.categoryStats('expense', filterMonth.value),
        window.api.assets.categoryStats('income', filterMonth.value),
        window.api.savings.list('plan'),
        window.api.savings.list('wish')
      ])
    accounts.value = accountData
    summary.value = summaryData
    trend.value = trendData
    expenseStats.value = expenseData
    incomeStats.value = incomeData
    plans.value = planData
    wishes.value = wishData
  } catch (err) {
    toast.error((err as Error).message)
  }
}

async function loadRecords(): Promise<void> {
  try {
    records.value = await window.api.assets.records({
      month: filterMonth.value,
      kind: filterKind.value === '' ? undefined : filterKind.value,
      limit: 200
    })
  } catch (err) {
    toast.error((err as Error).message)
  }
}

onMounted(async () => {
  await loadAll()
  await loadRecords()
})

/** 切换月份筛选后同时刷新记录与分类统计 */
async function applyFilter(): Promise<void> {
  await Promise.all([
    loadRecords(),
    window.api.assets
      .categoryStats('expense', filterMonth.value)
      .then((data) => (expenseStats.value = data)),
    window.api.assets
      .categoryStats('income', filterMonth.value)
      .then((data) => (incomeStats.value = data))
  ]).catch((err) => toast.error((err as Error).message))
}

/** 金额显示（隐藏时返回占位符） */
function moneyText(value: number): string {
  return showMoney.value ? `¥${formatMoney(value)}` : '¥****'
}

/* ------------------------------ 页签 ------------------------------ */

type TabKey = 'flow' | 'charts' | 'savings'
const tab = ref<TabKey>('flow')
const TABS: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'flow', label: '账户与收支', icon: 'wallet' },
  { key: 'charts', label: '统计图表', icon: 'chart' },
  { key: 'savings', label: '攒钱与想买', icon: 'piggy' }
]

/* ------------------------------ 账户编辑 ------------------------------ */

interface AccountForm {
  visible: boolean
  id?: number
  platform: string
  name: string
  balance: string
  note: string
}

const accountDialog = ref<AccountForm>({
  visible: false,
  id: undefined,
  platform: 'alipay',
  name: '',
  balance: '',
  note: ''
})

function openAccountCreate(): void {
  accountDialog.value = { visible: true, id: undefined, platform: 'alipay', name: '', balance: '', note: '' }
}

function openAccountEdit(item: AssetAccount): void {
  accountDialog.value = {
    visible: true,
    id: item.id,
    platform: item.platform,
    name: item.name,
    balance: String(item.balance),
    note: item.note
  }
}

async function saveAccount(): Promise<void> {
  const form = accountDialog.value
  try {
    await window.api.assets.saveAccount({
      id: form.id,
      platform: form.platform,
      name: form.name,
      balance: Number(form.balance || 0),
      note: form.note
    })
    accountDialog.value.visible = false
    await loadAll()
    toast.success(form.id ? '账户已更新' : '账户已添加')
  } catch (err) {
    toast.error((err as Error).message)
  }
}

const accountRemoveTarget = ref<AssetAccount | null>(null)

async function confirmRemoveAccount(): Promise<void> {
  const target = accountRemoveTarget.value
  if (!target) return
  try {
    await window.api.assets.removeAccount(target.id)
    accountRemoveTarget.value = null
    await loadAll()
    await loadRecords()
    toast.push(`已删除账户「${target.name}」及其收支记录`, 'info')
  } catch (err) {
    toast.error((err as Error).message)
  }
}

/* ------------------------------ 收支编辑 ------------------------------ */

interface RecordForm {
  visible: boolean
  id?: number
  kind: AssetRecordKind
  accountId: number | null
  category: string
  amount: string
  date: string
  note: string
}

const recordDialog = ref<RecordForm>({
  visible: false,
  id: undefined,
  kind: 'expense',
  accountId: null,
  category: '其他支出',
  amount: '',
  date: today,
  note: ''
})

function defaultCategory(kind: AssetRecordKind): string {
  return categoriesOf(kind)[0]
}

function openRecordCreate(kind: AssetRecordKind): void {
  if (accounts.value.length === 0) {
    toast.error('请先添加一个资产账户')
    tab.value = 'flow'
    openAccountCreate()
    return
  }
  recordDialog.value = {
    visible: true,
    id: undefined,
    kind,
    accountId: accounts.value[0].id,
    category: defaultCategory(kind),
    amount: '',
    date: today,
    note: ''
  }
}

function openRecordEdit(item: AssetRecordWithAccount): void {
  recordDialog.value = {
    visible: true,
    id: item.id,
    kind: item.kind,
    accountId: item.accountId,
    category: item.category,
    amount: String(item.amount),
    date: item.date,
    note: item.note
  }
}

/** 切换收支类型时同步默认分类 */
function switchRecordKind(kind: AssetRecordKind): void {
  recordDialog.value.kind = kind
  recordDialog.value.category = defaultCategory(kind)
}

async function saveRecord(): Promise<void> {
  const form = recordDialog.value
  if (form.accountId === null) {
    toast.error('请选择账户')
    return
  }
  const payload: AssetRecordInput = {
    id: form.id,
    accountId: form.accountId,
    kind: form.kind,
    category: form.category,
    amount: Number(form.amount || 0),
    date: form.date,
    note: form.note
  }
  try {
    await window.api.assets.saveRecord(payload)
    recordDialog.value.visible = false
    await loadAll()
    await loadRecords()
    toast.success(form.id ? '记录已更新' : '已记一笔')
  } catch (err) {
    toast.error((err as Error).message)
  }
}

const recordRemoveTarget = ref<AssetRecordWithAccount | null>(null)

async function confirmRemoveRecord(): Promise<void> {
  const target = recordRemoveTarget.value
  if (!target) return
  try {
    await window.api.assets.removeRecord(target.id)
    recordRemoveTarget.value = null
    await loadAll()
    await loadRecords()
    toast.push('已删除该条收支记录', 'info')
  } catch (err) {
    toast.error((err as Error).message)
  }
}

/* ------------------------------ 图表计算 ------------------------------ */

const PIE_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#64748b']

/** 资产分布（按账户余额，取前 7 + 其他） */
const pieSlices = computed(() => {
  const items = accounts.value
    .filter((a) => a.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .map((a) => ({ name: a.name, value: a.balance }))
  const total = items.reduce((sum, item) => sum + item.value, 0)
  if (total <= 0) return []
  const top = items.slice(0, 7)
  const rest = items.slice(7)
  if (rest.length > 0) top.push({ name: '其他', value: rest.reduce((s, i) => s + i.value, 0) })
  let offset = 0
  return top.map((item, index) => {
    const ratio = item.value / total
    const slice = { ...item, ratio, offset, color: PIE_COLORS[index % PIE_COLORS.length] }
    offset += ratio
    return slice
  })
})

/** SVG 圆环分段（viewBox 42x42，周长 ≈ 100 的圆） */
const PIE_R = 15.9155
const pieSegments = computed(() =>
  pieSlices.value.map((slice) => ({
    ...slice,
    dash: `${(slice.ratio * 100).toFixed(2)} ${(100 - slice.ratio * 100).toFixed(2)}`,
    offset: `${(25 - slice.offset * 100).toFixed(2)}`
  }))
)

/** 资产趋势折线（近 30 天总资产） */
const trendLine = computed(() => {
  const points = trend.value
  if (points.length === 0) return null
  const values = points.map((p) => p.total)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const W = 100
  const H = 40
  const step = points.length > 1 ? W / (points.length - 1) : 0
  const coords = points.map((p, i) => {
    const x = i * step
    const y = H - ((p.total - min) / span) * (H - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return {
    points: coords.join(' '),
    min,
    max,
    first: points[0].date.slice(5),
    last: points[points.length - 1].date.slice(5)
  }
})

/** 分类统计条形图（金额占比） */
function statRows(list: AssetCategoryStat[]): Array<AssetCategoryStat & { ratio: number }> {
  const max = Math.max(1, ...list.map((item) => item.amount))
  return list.map((item) => ({ ...item, ratio: Math.round((item.amount / max) * 100) }))
}

const expenseRows = computed(() => statRows(expenseStats.value))
const incomeRows = computed(() => statRows(incomeStats.value))

/* ------------------------------ 攒钱与想买 ------------------------------ */

const savingKind = ref<'plan' | 'wish'>('plan')

const PERIOD_LABELS: Record<string, string> = {
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
  yearly: '每年',
  none: '仅手动存入'
}

const goalList = computed(() => (savingKind.value === 'plan' ? plans.value : wishes.value))

interface GoalForm {
  visible: boolean
  id?: number
  name: string
  target: string
  period: SavingGoalInput['period']
  perAmount: string
  note: string
}

const goalDialog = ref<GoalForm>({
  visible: false,
  id: undefined,
  name: '',
  target: '',
  period: 'monthly',
  perAmount: '',
  note: ''
})

function openGoalCreate(): void {
  goalDialog.value = {
    visible: true,
    id: undefined,
    name: '',
    target: '',
    period: 'monthly',
    perAmount: '',
    note: ''
  }
}

function openGoalEdit(item: SavingGoalWithProgress): void {
  goalDialog.value = {
    visible: true,
    id: item.id,
    name: item.name,
    target: String(item.target),
    period: item.period,
    perAmount: item.period === 'none' ? '' : String(item.perAmount),
    note: item.note
  }
}

async function saveGoal(): Promise<void> {
  const form = goalDialog.value
  const payload: SavingGoalInput = {
    id: form.id,
    kind: savingKind.value,
    name: form.name,
    target: Number(form.target || 0),
    period: form.period,
    perAmount: form.period === 'none' ? 0 : Number(form.perAmount || 0),
    startDate: today,
    note: form.note
  }
  try {
    await window.api.savings.save(payload)
    goalDialog.value.visible = false
    await loadAll()
    toast.success(form.id ? '目标已更新' : savingKind.value === 'plan' ? '攒钱计划已创建' : '已加入想买清单')
  } catch (err) {
    toast.error((err as Error).message)
  }
}

const goalRemoveTarget = ref<SavingGoalWithProgress | null>(null)

async function confirmRemoveGoal(): Promise<void> {
  const target = goalRemoveTarget.value
  if (!target) return
  try {
    await window.api.savings.remove(target.id)
    goalRemoveTarget.value = null
    await loadAll()
    toast.push(`已删除「${target.name}」`, 'info')
  } catch (err) {
    toast.error((err as Error).message)
  }
}

/** 存入弹窗 */
const depositDialog = ref({ visible: false, goal: null as SavingGoalWithProgress | null, amount: '', note: '' })

function openDeposit(goal: SavingGoalWithProgress): void {
  depositDialog.value = {
    visible: true,
    goal,
    amount: goal.period !== 'none' && goal.perAmount > 0 ? String(goal.perAmount) : '',
    note: ''
  }
}

async function saveDeposit(): Promise<void> {
  const { goal, amount, note } = depositDialog.value
  if (!goal) return
  try {
    const updated = await window.api.savings.deposit(goal.id, Number(amount || 0), note)
    depositDialog.value.visible = false
    await loadAll()
    if (updated.done && updated.saved >= updated.target) {
      toast.success(`🎉「${updated.name}」已达成目标！`)
    } else {
      toast.success(`已存入 ¥${formatMoney(Number(amount || 0))}`)
    }
  } catch (err) {
    toast.error((err as Error).message)
  }
}

/** 自动存款计划的描述（如「每月存 500 · 预计 8 个月达成」） */
function planDesc(goal: SavingGoalWithProgress): string {
  if (goal.period === 'none' || goal.perAmount <= 0) return '手动存入'
  const rest = Math.max(0, goal.target - goal.saved)
  const periods = rest <= 0 ? 0 : Math.ceil(rest / goal.perAmount)
  const unit =
    goal.period === 'daily' ? '天' : goal.period === 'weekly' ? '周' : goal.period === 'monthly' ? '个月' : '年'
  const tail = periods > 0 ? ` · 约 ${periods} ${unit}达成` : ''
  return `${PERIOD_LABELS[goal.period]}存 ¥${formatMoney(goal.perAmount)}${tail}`
}
</script>

<template>
  <div class="page">
    <header class="page-head">
      <div class="head-left">
        <span class="head-icon"><Icon name="wallet" :size="17" /></span>
        <div class="head-text">
          <h1>资产</h1>
          <p>多平台账户、收支统计与攒钱计划</p>
        </div>
      </div>
      <div class="head-actions">
        <button class="btn btn-ghost btn-sm" @click="openRecordCreate('income')">
          <Icon name="plus" :size="12" />记收入
        </button>
        <button class="btn btn-primary btn-sm" @click="openRecordCreate('expense')">
          <Icon name="plus" :size="12" />记支出
        </button>
      </div>
    </header>

    <!-- 概览卡片 -->
    <section class="sum-row">
      <div class="sum-card total">
        <div class="sum-head">
          <span class="sum-label">总资产</span>
          <button
            class="eye-btn"
            :title="showMoney ? '隐藏金额' : '显示金额'"
            @click="showMoney = !showMoney"
          >
            <Icon :name="showMoney ? 'eye' : 'eyeOff'" :size="13" />
          </button>
        </div>
        <span class="sum-value">{{ moneyText(summary?.total ?? 0) }}</span>
        <span class="sum-sub">{{ summary?.accountCount ?? 0 }} 个账户</span>
      </div>
      <div class="sum-card income">
        <span class="sum-label">本月收入</span>
        <span class="sum-value">+{{ moneyText(summary?.monthIncome ?? 0) }}</span>
        <span class="sum-sub">{{ filterMonth }} 收入合计</span>
      </div>
      <div class="sum-card expense">
        <span class="sum-label">本月支出</span>
        <span class="sum-value">-{{ moneyText(summary?.monthExpense ?? 0) }}</span>
        <span class="sum-sub">{{ filterMonth }} 支出合计</span>
      </div>
      <div class="sum-card saving">
        <span class="sum-label">攒钱进度</span>
        <span class="sum-value">
          {{ plans.filter((p) => p.done).length + wishes.filter((w) => w.done).length }}/{{ plans.length + wishes.length }}
        </span>
        <span class="sum-sub">已达成目标数</span>
      </div>
    </section>

    <!-- 页签 -->
    <nav class="tab-row">
      <button
        v-for="item in TABS"
        :key="item.key"
        class="tab-btn"
        :class="{ active: tab === item.key }"
        @click="tab = item.key"
      >
        <Icon :name="item.icon" :size="13" />{{ item.label }}
      </button>
    </nav>

    <!-- 账户与收支 -->
    <section v-if="tab === 'flow'" class="flow-grid">
      <div class="card">
        <div class="card-header">
          <span class="card-title"><Icon name="wallet" :size="15" />我的账户</span>
          <span class="card-sub">{{ accounts.length }} 个</span>
          <button class="card-action" @click="openAccountCreate">
            <Icon name="plus" :size="12" />添加账户
          </button>
        </div>
        <div v-if="accounts.length === 0" class="empty">
          <Icon name="wallet" :size="24" />
          <span>还没有账户，点击「添加账户」开始管理资产</span>
        </div>
        <div v-else class="account-list">
          <div v-for="item in accounts" :key="item.id" class="account-item">
            <PlatformIcon :platform="item.platform" :size="32" />
            <div class="account-main">
              <span class="account-name">
                {{ item.name }}
                <span class="tag tag-plain">{{ platformOf(item.platform).name }}</span>
              </span>
              <span class="account-sub">{{ item.note || '—' }}</span>
            </div>
            <span class="account-balance">{{ moneyText(item.balance) }}</span>
            <div class="row-actions">
              <button class="icon-btn" title="编辑" @click="openAccountEdit(item)">
                <Icon name="edit" :size="13" />
              </button>
              <button class="icon-btn danger" title="删除" @click="accountRemoveTarget = item">
                <Icon name="trash" :size="13" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title"><Icon name="list" :size="15" />收支记录</span>
          <input
            v-model="filterMonth"
            class="month-input"
            type="month"
            @change="applyFilter"
          />
          <div class="kind-filter">
            <button
              class="chip"
              :class="{ active: filterKind === '' }"
              @click="filterKind = ''; applyFilter()"
            >
              全部
            </button>
            <button
              class="chip income"
              :class="{ active: filterKind === 'income' }"
              @click="filterKind = 'income'; applyFilter()"
            >
              收入
            </button>
            <button
              class="chip expense"
              :class="{ active: filterKind === 'expense' }"
              @click="filterKind = 'expense'; applyFilter()"
            >
              支出
            </button>
          </div>
        </div>
        <div v-if="records.length === 0" class="empty">
          <Icon name="list" :size="24" />
          <span>该月份暂无收支记录，点击右上角「记收入 / 记支出」</span>
        </div>
        <div v-else class="record-list">
          <div v-for="item in records" :key="item.id" class="record-item">
            <span class="record-cat" :class="item.kind">{{ item.category }}</span>
            <div class="record-main">
              <span class="record-title">
                <PlatformIcon :platform="item.platform" :size="16" />{{ item.accountName }}
                <span v-if="item.note" class="record-note">· {{ item.note }}</span>
              </span>
              <span class="record-date">{{ item.date }}</span>
            </div>
            <span class="record-amount" :class="item.kind">
              {{ item.kind === 'income' ? '+' : '-' }}{{ moneyText(item.amount) }}
            </span>
            <div class="row-actions">
              <button class="icon-btn" title="编辑" @click="openRecordEdit(item)">
                <Icon name="edit" :size="13" />
              </button>
              <button class="icon-btn danger" title="删除" @click="recordRemoveTarget = item">
                <Icon name="trash" :size="13" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 统计图表 -->
    <section v-else-if="tab === 'charts'" class="charts-grid">
      <div class="card">
        <div class="card-header">
          <span class="card-title"><Icon name="chart" :size="15" />资产分布</span>
          <span class="card-sub">按账户余额</span>
        </div>
        <div v-if="pieSlices.length === 0" class="empty">
          <Icon name="chart" :size="24" />
          <span>暂无资产数据，添加账户后展示分布饼图</span>
        </div>
        <div v-else class="pie-wrap">
          <svg viewBox="0 0 42 42" class="pie">
            <circle cx="21" cy="21" :r="PIE_R" fill="none" stroke="var(--plain-bg)" stroke-width="7" />
            <circle
              v-for="seg in pieSegments"
              :key="seg.name"
              cx="21"
              cy="21"
              :r="PIE_R"
              fill="none"
              :stroke="seg.color"
              stroke-width="7"
              :stroke-dasharray="seg.dash"
              :stroke-dashoffset="seg.offset"
            />
            <text x="21" y="20" text-anchor="middle" class="pie-total">
              {{ showMoney ? formatMoneyShort(summary?.total ?? 0) : '****' }}
            </text>
            <text x="21" y="26" text-anchor="middle" class="pie-unit">总资产(元)</text>
          </svg>
          <ul class="pie-legend">
            <li v-for="slice in pieSlices" :key="slice.name">
              <i :style="{ background: slice.color }"></i>
              <span class="pie-name">{{ slice.name }}</span>
              <span class="pie-val">{{ moneyText(slice.value) }}（{{ Math.round(slice.ratio * 100) }}%）</span>
            </li>
          </ul>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title"><Icon name="chart" :size="15" />近 30 天资产趋势</span>
          <span class="card-sub">由收支记录推算</span>
        </div>
        <div v-if="!trendLine" class="empty">
          <Icon name="chart" :size="24" />
          <span>暂无数据</span>
        </div>
        <div v-else class="trend-wrap">
          <svg viewBox="0 0 100 44" preserveAspectRatio="none" class="trend-svg">
            <polyline
              :points="trendLine.points"
              fill="none"
              stroke="var(--green-500)"
              stroke-width="1.4"
              stroke-linejoin="round"
              stroke-linecap="round"
              vector-effect="non-scaling-stroke"
            />
          </svg>
          <div class="trend-axis">
            <span>{{ trendLine.first }}</span>
            <span class="trend-range">
              {{ showMoney ? `¥${formatMoneyShort(trendLine.min)} ~ ¥${formatMoneyShort(trendLine.max)}` : '****'
              }}
            </span>
            <span>{{ trendLine.last }}</span>
          </div>
        </div>
        <div class="chart-cols">
          <div class="chart-col">
            <div class="section-title"><span>支出分类（{{ filterMonth }}）</span></div>
            <div v-if="expenseRows.length === 0" class="empty slim"><span>本月暂无支出</span></div>
            <div v-for="row in expenseRows" :key="row.category" class="bar-row">
              <span class="bar-label">{{ row.category }}</span>
              <span class="bar-track"><i class="expense" :style="{ width: `${row.ratio}%` }"></i></span>
              <span class="bar-val">{{ moneyText(row.amount) }}</span>
            </div>
          </div>
          <div class="chart-col">
            <div class="section-title"><span>收入分类（{{ filterMonth }}）</span></div>
            <div v-if="incomeRows.length === 0" class="empty slim"><span>本月暂无收入</span></div>
            <div v-for="row in incomeRows" :key="row.category" class="bar-row">
              <span class="bar-label">{{ row.category }}</span>
              <span class="bar-track"><i class="income" :style="{ width: `${row.ratio}%` }"></i></span>
              <span class="bar-val">{{ moneyText(row.amount) }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 攒钱与想买 -->
    <section v-else class="saving-grid">
      <div class="saving-head">
        <div class="seg">
          <button class="seg-btn" :class="{ active: savingKind === 'plan' }" @click="savingKind = 'plan'">
            <Icon name="piggy" :size="12" />攒钱计划（{{ plans.length }}）
          </button>
          <button class="seg-btn" :class="{ active: savingKind === 'wish' }" @click="savingKind = 'wish'">
            <Icon name="cart" :size="12" />想买（{{ wishes.length }}）
          </button>
        </div>
        <button class="btn btn-primary btn-sm" @click="openGoalCreate">
          <Icon name="plus" :size="12" />{{ savingKind === 'plan' ? '新建攒钱计划' : '添加想买' }}
        </button>
      </div>

      <div v-if="goalList.length === 0" class="card">
        <div class="empty">
          <Icon :name="savingKind === 'plan' ? 'piggy' : 'cart'" :size="24" />
          <span>{{
            savingKind === 'plan'
              ? '还没有攒钱计划，设置目标金额与存款周期开始攒钱'
              : '还没有想买的东西，输入目标商品金额开始为它存钱'
          }}</span>
        </div>
      </div>
      <div v-else class="goal-cards">
        <div v-for="goal in goalList" :key="goal.id" class="card goal-card" :class="{ done: goal.done }">
          <div class="goal-head">
            <span class="goal-icon" :class="goal.kind">
              <Icon :name="goal.kind === 'plan' ? 'piggy' : 'cart'" :size="15" />
            </span>
            <div class="goal-title">
              <span class="goal-name">
                {{ goal.name }}
                <span v-if="goal.done" class="tag tag-yellow">已达成</span>
              </span>
              <span class="goal-desc">{{ planDesc(goal) }}</span>
            </div>
            <div class="row-actions">
              <button class="icon-btn" title="编辑" @click="openGoalEdit(goal)">
                <Icon name="edit" :size="13" />
              </button>
              <button class="icon-btn danger" title="删除" @click="goalRemoveTarget = goal">
                <Icon name="trash" :size="13" />
              </button>
            </div>
          </div>
          <div class="goal-progress">
            <span class="goal-bar"><i :style="{ width: `${goal.percent}%` }"></i></span>
            <span class="goal-percent">{{ goal.percent }}%</span>
          </div>
          <div class="goal-nums">
            <span>{{ moneyText(goal.saved) }} / {{ moneyText(goal.target) }}</span>
            <button class="btn btn-ghost btn-sm" :disabled="goal.done" @click="openDeposit(goal)">
              <Icon name="coins" :size="12" />存入
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- 账户编辑弹窗 -->
    <ModalDialog
      :visible="accountDialog.visible"
      :title="accountDialog.id ? '编辑账户' : '添加账户'"
      width="430px"
      @close="accountDialog.visible = false"
    >
      <div class="field">
        <span class="field-label">平台</span>
        <div class="platform-grid">
          <button
            v-for="p in ASSET_PLATFORMS"
            :key="p.key"
            class="platform-btn"
            :class="{ active: accountDialog.platform === p.key }"
            :title="p.name"
            @click="accountDialog.platform = p.key"
          >
            <PlatformIcon :platform="p.key" :size="24" />
            <span>{{ p.name }}</span>
          </button>
        </div>
      </div>
      <label class="field">
        <span class="field-label">账户名称</span>
        <input v-model="accountDialog.name" class="input" placeholder="例如：招商工资卡" maxlength="20" />
      </label>
      <div class="field-row">
        <label class="field">
          <span class="field-label">当前余额（元）</span>
          <input v-model="accountDialog.balance" class="input" type="number" step="0.01" placeholder="0.00" />
        </label>
        <label class="field">
          <span class="field-label">备注（选填）</span>
          <input v-model="accountDialog.note" class="input" placeholder="例如：日常开销卡" maxlength="30" />
        </label>
      </div>
      <template #footer>
        <button class="btn btn-plain" @click="accountDialog.visible = false">取消</button>
        <button class="btn btn-primary" @click="saveAccount">保存</button>
      </template>
    </ModalDialog>

    <!-- 收支编辑弹窗 -->
    <ModalDialog
      :visible="recordDialog.visible"
      :title="recordDialog.id ? '编辑记录' : recordDialog.kind === 'income' ? '记收入' : '记支出'"
      width="430px"
      @close="recordDialog.visible = false"
    >
      <div class="field">
        <span class="field-label">类型</span>
        <div class="seg">
          <button
            class="seg-btn expense"
            :class="{ active: recordDialog.kind === 'expense' }"
            @click="switchRecordKind('expense')"
          >
            支出
          </button>
          <button
            class="seg-btn income"
            :class="{ active: recordDialog.kind === 'income' }"
            @click="switchRecordKind('income')"
          >
            收入
          </button>
        </div>
      </div>
      <div class="field-row">
        <label class="field grow">
          <span class="field-label">金额（元）</span>
          <input v-model="recordDialog.amount" class="input" type="number" step="0.01" min="0" placeholder="0.00" />
        </label>
        <label class="field">
          <span class="field-label">日期</span>
          <input v-model="recordDialog.date" class="input" type="date" />
        </label>
      </div>
      <div class="field-row">
        <label class="field">
          <span class="field-label">账户</span>
          <select v-model.number="recordDialog.accountId" class="select">
            <option v-for="a in accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </label>
        <label class="field">
          <span class="field-label">分类</span>
          <select v-model="recordDialog.category" class="select">
            <option v-for="c in categoriesOf(recordDialog.kind)" :key="c" :value="c">{{ c }}</option>
          </select>
        </label>
      </div>
      <label class="field">
        <span class="field-label">备注（选填）</span>
        <input v-model="recordDialog.note" class="input" placeholder="例如：午餐" maxlength="30" />
      </label>
      <template #footer>
        <button class="btn btn-plain" @click="recordDialog.visible = false">取消</button>
        <button class="btn btn-primary" @click="saveRecord">保存</button>
      </template>
    </ModalDialog>

    <!-- 攒钱目标编辑弹窗 -->
    <ModalDialog
      :visible="goalDialog.visible"
      :title="goalDialog.id ? '编辑目标' : savingKind === 'plan' ? '新建攒钱计划' : '添加想买'"
      width="430px"
      @close="goalDialog.visible = false"
    >
      <label class="field">
        <span class="field-label">{{ savingKind === 'plan' ? '计划名称' : '商品名称' }}</span>
        <input
          v-model="goalDialog.name"
          class="input"
          :placeholder="savingKind === 'plan' ? '例如：旅行基金' : '例如：新相机'"
          maxlength="20"
        />
      </label>
      <div class="field-row">
        <label class="field">
          <span class="field-label">目标金额（元）</span>
          <input v-model="goalDialog.target" class="input" type="number" step="0.01" min="0" placeholder="0.00" />
        </label>
        <label class="field">
          <span class="field-label">存款周期</span>
          <select v-model="goalDialog.period" class="select">
            <option value="none">仅手动存入</option>
            <option value="daily">每天</option>
            <option value="weekly">每周</option>
            <option value="monthly">每月</option>
            <option value="yearly">每年</option>
          </select>
        </label>
      </div>
      <label v-if="goalDialog.period !== 'none'" class="field">
        <span class="field-label">每周期计划存入（元）</span>
        <input v-model="goalDialog.perAmount" class="input" type="number" step="0.01" min="0" placeholder="0.00" />
      </label>
      <label class="field">
        <span class="field-label">备注（选填）</span>
        <input v-model="goalDialog.note" class="input" placeholder="选填" maxlength="30" />
      </label>
      <template #footer>
        <button class="btn btn-plain" @click="goalDialog.visible = false">取消</button>
        <button class="btn btn-primary" @click="saveGoal">保存</button>
      </template>
    </ModalDialog>

    <!-- 存入弹窗 -->
    <ModalDialog
      :visible="depositDialog.visible"
      :title="`存入「${depositDialog.goal?.name ?? ''}」`"
      width="400px"
      @close="depositDialog.visible = false"
    >
      <label class="field">
        <span class="field-label">存入金额（元）</span>
        <input v-model="depositDialog.amount" class="input" type="number" step="0.01" min="0" placeholder="0.00" />
      </label>
      <label class="field">
        <span class="field-label">备注（选填）</span>
        <input v-model="depositDialog.note" class="input" placeholder="例如：本月工资存入" maxlength="30" />
      </label>
      <template #footer>
        <button class="btn btn-plain" @click="depositDialog.visible = false">取消</button>
        <button class="btn btn-primary" @click="saveDeposit">存入</button>
      </template>
    </ModalDialog>

    <!-- 删除确认 -->
    <ConfirmDialog
      :visible="accountRemoveTarget !== null"
      title="删除账户"
      :message="`确定删除账户「${accountRemoveTarget?.name ?? ''}」吗？该账户的收支记录将一并删除且无法恢复。`"
      @close="accountRemoveTarget = null"
      @confirm="confirmRemoveAccount"
    />
    <ConfirmDialog
      :visible="recordRemoveTarget !== null"
      title="删除收支记录"
      :message="`确定删除这条${recordRemoveTarget?.kind === 'income' ? '收入' : '支出'}记录吗？删除后账户余额将自动冲正。`"
      @close="recordRemoveTarget = null"
      @confirm="confirmRemoveRecord"
    />
    <ConfirmDialog
      :visible="goalRemoveTarget !== null"
      :title="goalRemoveTarget?.kind === 'plan' ? '删除攒钱计划' : '删除想买'"
      :message="`确定删除「${goalRemoveTarget?.name ?? ''}」吗？已存入的明细将一并删除。`"
      @close="goalRemoveTarget = null"
      @confirm="confirmRemoveGoal"
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
  background: linear-gradient(135deg, #f59e0b, #d97706);
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

.head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ------------------------------ 概览卡片 ------------------------------ */
.sum-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.sum-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 13px 16px;
  border-radius: 14px;
  background: var(--surface);
  box-shadow: var(--shadow-card);
  border: 1px solid var(--border);
}

.sum-card.total {
  background: linear-gradient(120deg, var(--hero-from), var(--hero-mid));
  border: none;
  color: #fff;
}

.sum-card.total .sum-label,
.sum-card.total .sum-sub {
  color: rgba(255, 255, 255, 0.82);
}

.sum-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.eye-btn {
  border: none;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  width: 22px;
  height: 22px;
  border-radius: 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.eye-btn:hover {
  background: rgba(255, 255, 255, 0.34);
}

.sum-label {
  font-size: 11.5px;
  color: var(--text-3);
  font-weight: 600;
}

.sum-value {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sum-card.income .sum-value {
  color: var(--green-600);
}

.sum-card.expense .sum-value {
  color: var(--red);
}

.sum-sub {
  font-size: 11px;
  color: var(--text-3);
}

/* ------------------------------ 页签 ------------------------------ */
.tab-row {
  display: flex;
  gap: 6px;
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-2);
  cursor: pointer;
  transition: all 0.15s;
}

.tab-btn.active {
  background: var(--green-100);
  border-color: var(--green-500);
  color: var(--green-700);
}

/* ------------------------------ 账户与收支 ------------------------------ */
.flow-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  gap: 14px;
  align-items: start;
}

.account-list,
.record-list {
  display: flex;
  flex-direction: column;
}

.account-item,
.record-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 2px;
  border-bottom: 1px dashed var(--border);
}

.account-item:last-child,
.record-item:last-child {
  border-bottom: none;
}

.account-main,
.record-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.account-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
}

.account-sub {
  font-size: 11.5px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.account-balance {
  flex: none;
  font-size: 13.5px;
  font-weight: 800;
  color: var(--text-1);
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: none;
}

.month-input {
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-1);
  font-family: inherit;
  font-size: 12px;
}

.kind-filter {
  display: inline-flex;
  gap: 4px;
  margin-left: auto;
}

.chip {
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  color: var(--text-2);
  cursor: pointer;
}

.chip.active {
  background: var(--green-100);
  border-color: var(--green-500);
  color: var(--green-700);
}

.chip.income.active {
  background: var(--green-100);
  border-color: var(--green-500);
  color: var(--green-700);
}

.chip.expense.active {
  background: var(--red-soft);
  border-color: var(--red);
  color: var(--red);
}

.record-cat {
  flex: none;
  min-width: 52px;
  text-align: center;
  padding: 3px 8px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 700;
}

.record-cat.expense {
  background: var(--red-soft);
  color: var(--red);
}

.record-cat.income {
  background: var(--green-100);
  color: var(--green-700);
}

.record-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.8px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
}

.record-note {
  font-weight: 400;
  color: var(--text-3);
  font-size: 11.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.record-date {
  font-size: 11px;
  color: var(--text-3);
}

.record-amount {
  flex: none;
  font-size: 13px;
  font-weight: 800;
}

.record-amount.income {
  color: var(--green-600);
}

.record-amount.expense {
  color: var(--red);
}

/* ------------------------------ 图表 ------------------------------ */
.charts-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
  gap: 14px;
  align-items: start;
}

.pie-wrap {
  display: flex;
  align-items: center;
  gap: 18px;
}

.pie {
  width: 150px;
  height: 150px;
  flex: none;
}

.pie-total {
  font-size: 6.5px;
  font-weight: 800;
  fill: var(--text-1);
}

.pie-unit {
  font-size: 3.4px;
  fill: var(--text-3);
}

.pie-legend {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
  list-style: none;
}

.pie-legend li {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
}

.pie-legend i {
  width: 9px;
  height: 9px;
  border-radius: 3px;
  flex: none;
}

.pie-name {
  font-weight: 700;
  color: var(--text-1);
}

.pie-val {
  margin-left: auto;
  color: var(--text-3);
  font-size: 11.5px;
  white-space: nowrap;
}

.trend-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.trend-svg {
  width: 100%;
  height: 120px;
}

.trend-axis {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-3);
}

.chart-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-top: 12px;
}

.section-title {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-1);
  margin-bottom: 8px;
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.bar-label {
  width: 56px;
  flex: none;
  font-size: 11.5px;
  color: var(--text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bar-track {
  flex: 1;
  height: 8px;
  border-radius: 999px;
  background: var(--plain-bg);
  overflow: hidden;
}

.bar-track i {
  display: block;
  height: 100%;
  border-radius: 999px;
}

.bar-track i.expense {
  background: var(--red);
}

.bar-track i.income {
  background: var(--green-500);
}

.bar-val {
  flex: none;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-1);
}

/* ------------------------------ 攒钱与想买 ------------------------------ */
.saving-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.saving-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.seg {
  display: inline-flex;
  padding: 3px;
  gap: 3px;
  border-radius: 999px;
  background: var(--plain-bg);
}

.seg-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: none;
  border-radius: 999px;
  padding: 6px 16px;
  font-size: 12.5px;
  font-family: inherit;
  font-weight: 600;
  color: var(--text-2);
  background: transparent;
  cursor: pointer;
  transition: all 0.15s;
}

.seg-btn.active {
  background: var(--surface);
  color: var(--green-700);
  box-shadow: var(--shadow-card);
}

.seg-btn.expense.active {
  color: var(--red);
}

.seg-btn.income.active {
  color: var(--green-700);
}

.goal-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.goal-card.done {
  border-color: var(--yellow);
}

.goal-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.goal-icon {
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.goal-icon.plan {
  background: var(--yellow-soft);
  color: var(--yellow-ink);
}

.goal-icon.wish {
  background: var(--blue-soft);
  color: var(--blue-ink);
}

.goal-title {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.goal-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
}

.goal-desc {
  font-size: 11px;
  color: var(--text-3);
}

.goal-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}

.goal-bar {
  flex: 1;
  height: 8px;
  border-radius: 999px;
  background: var(--plain-bg);
  overflow: hidden;
}

.goal-bar i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--green-500), var(--green-600));
  transition: width 0.3s ease;
}

.goal-percent {
  flex: none;
  font-size: 12px;
  font-weight: 800;
  color: var(--green-600);
}

.goal-nums {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-1);
}

/* ------------------------------ 平台选择 ------------------------------ */
.platform-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.platform-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  font-family: inherit;
  font-size: 10.5px;
  color: var(--text-2);
  cursor: pointer;
  transition: all 0.13s;
}

.platform-btn.active {
  border-color: var(--green-500);
  background: var(--green-50);
  color: var(--green-700);
  font-weight: 700;
}

.field.grow {
  flex: 1;
}

/* ------------------------------ 响应式 ------------------------------ */
@media (max-width: 1240px) {
  .sum-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .flow-grid,
  .charts-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 560px) {
  .sum-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .chart-cols {
    grid-template-columns: minmax(0, 1fr);
  }

  .pie-wrap {
    flex-direction: column;
  }

  .platform-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
