/**
 * 日程颜色标记调色板：供日程编辑弹窗与日历「添加日程」弹窗共用。
 * 取色向六套主题的配色靠拢，保证浅色 / 深色主题下均有良好对比度。
 */

export interface ScheduleColorOption {
  /** 色值（写入 schedules.color） */
  value: string
  /** 中文名称（用于 title / aria-label） */
  label: string
}

/** 可选日程颜色（空串表示不标记，由使用方单独提供「默认」选项） */
export const SCHEDULE_COLORS: ScheduleColorOption[] = [
  { value: '#e86a5e', label: '红色' },
  { value: '#e08b4f', label: '橙色' },
  { value: '#e0b23c', label: '黄色' },
  { value: '#5daf74', label: '绿色' },
  { value: '#46b3a1', label: '青色' },
  { value: '#4c9fd0', label: '蓝色' },
  { value: '#8a7bcd', label: '紫色' },
  { value: '#d97ea1', label: '粉色' }
]