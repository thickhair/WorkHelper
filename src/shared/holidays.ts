/**
 * 法定节假日与调休安排（数据来源：国务院办公厅各年度「部分节假日安排」通知）。
 * 说明：仅收录通知已公布的年份；未收录年份在日历中仍会显示农历与传统节日。
 */
import { addDays } from './logic'

/** 单个假期的安排 */
export interface HolidayPlan {
  /** 假期名称（如「春节」「国庆节、中秋节」） */
  name: string
  /** 放假开始日期（含） */
  start: string
  /** 放假结束日期（含） */
  end: string
  /** 调休上班日期 */
  workDays: string[]
}

/** 各年度放假安排（按年份升序） */
export const HOLIDAY_PLANS: HolidayPlan[] = [
  /* ------------------------------ 2024 年 ------------------------------ */
  { name: '元旦', start: '2023-12-30', end: '2024-01-01', workDays: [] },
  { name: '春节', start: '2024-02-10', end: '2024-02-17', workDays: ['2024-02-04', '2024-02-18'] },
  { name: '清明节', start: '2024-04-04', end: '2024-04-06', workDays: ['2024-04-07'] },
  { name: '劳动节', start: '2024-05-01', end: '2024-05-05', workDays: ['2024-04-28', '2024-05-11'] },
  { name: '端午节', start: '2024-06-08', end: '2024-06-10', workDays: [] },
  { name: '中秋节', start: '2024-09-15', end: '2024-09-17', workDays: ['2024-09-14'] },
  { name: '国庆节', start: '2024-10-01', end: '2024-10-07', workDays: ['2024-09-29', '2024-10-12'] },

  /* ------------------------------ 2025 年 ------------------------------ */
  { name: '元旦', start: '2025-01-01', end: '2025-01-01', workDays: [] },
  { name: '春节', start: '2025-01-28', end: '2025-02-04', workDays: ['2025-01-26', '2025-02-08'] },
  { name: '清明节', start: '2025-04-04', end: '2025-04-06', workDays: [] },
  { name: '劳动节', start: '2025-05-01', end: '2025-05-05', workDays: ['2025-04-27'] },
  { name: '端午节', start: '2025-05-31', end: '2025-06-02', workDays: [] },
  { name: '国庆节、中秋节', start: '2025-10-01', end: '2025-10-08', workDays: ['2025-09-28', '2025-10-11'] },

  /* ------------------------------ 2026 年 ------------------------------ */
  { name: '元旦', start: '2026-01-01', end: '2026-01-03', workDays: ['2026-01-04'] },
  { name: '春节', start: '2026-02-15', end: '2026-02-23', workDays: ['2026-02-14', '2026-02-28'] },
  { name: '清明节', start: '2026-04-04', end: '2026-04-06', workDays: [] },
  { name: '劳动节', start: '2026-05-01', end: '2026-05-05', workDays: ['2026-05-09'] },
  { name: '端午节', start: '2026-06-19', end: '2026-06-21', workDays: [] },
  { name: '中秋节', start: '2026-09-25', end: '2026-09-27', workDays: [] },
  { name: '国庆节', start: '2026-10-01', end: '2026-10-07', workDays: ['2026-09-20', '2026-10-10'] }
]

/** 某天的放假 / 调休信息 */
export interface HolidayDay {
  /** 假期名称 */
  name: string
  /** off = 放假；work = 调休上班 */
  type: 'off' | 'work'
}

/** 已收录放假安排的年份（用于界面提示） */
export const HOLIDAY_YEARS: number[] = Array.from(
  new Set(HOLIDAY_PLANS.flatMap((plan) => [plan.start, plan.end].map((d) => Number(d.slice(0, 4)))))
).sort((a, b) => a - b)

/** 日期 → 放假 / 调休信息 */
export const HOLIDAY_MAP: Map<string, HolidayDay> = (() => {
  const map = new Map<string, HolidayDay>()
  for (const plan of HOLIDAY_PLANS) {
    let cursor = plan.start
    // 放假区间内的每一天都标记为放假，便于日历逐日查询
    while (cursor <= plan.end) {
      map.set(cursor, { name: plan.name, type: 'off' })
      cursor = addDays(cursor, 1)
    }
    for (const day of plan.workDays) {
      map.set(day, { name: plan.name, type: 'work' })
    }
  }
  return map
})()

/** 查询某天的法定节假日 / 调休信息（未收录或无安排时返回 undefined） */
export function holidayOf(date: string): HolidayDay | undefined {
  return HOLIDAY_MAP.get(date)
}