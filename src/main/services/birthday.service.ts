/**
 * 生日领域服务：生日（支持公历 / 农历与提前提醒）的增删改查、
 * 以及按「今天」计算的下一次生日列表（供日历页与系统提醒使用）。
 */
import { getDb } from '../db/database'
import { daysUntilBirthday, nextBirthdayDate } from '@shared/calendar'
import type { Birthday, BirthdayInput } from '@shared/types'

/** 数据库行 → 生日对象 */
function mapBirthday(row: Record<string, unknown>): Birthday {
  return {
    id: Number(row.id),
    name: String(row.name),
    calendar: String(row.calendar) === 'lunar' ? 'lunar' : 'solar',
    month: Number(row.month),
    day: Number(row.day),
    remindDays: Number(row.remind_days ?? 0),
    note: String(row.note ?? ''),
    createdAt: String(row.created_at ?? '')
  }
}

/** 规范化并校验输入（月份 1-12；公历日按当月天数、农历日 1-30；提醒天数 0-60） */
function normalize(input: BirthdayInput): BirthdayInput {
  const calendar = input.calendar === 'lunar' ? 'lunar' : 'solar'
  const month = Math.min(12, Math.max(1, Math.round(Number(input.month) || 1)))
  // 用闰年 2024 校验公历日的上限，保证 2 月 29 日可被保存
  const maxDay = calendar === 'lunar' ? 30 : new Date(2024, month, 0).getDate()
  const day = Math.min(maxDay, Math.max(1, Math.round(Number(input.day) || 1)))
  const remindDays = Math.min(60, Math.max(0, Math.round(Number(input.remindDays) || 0)))
  return {
    name: String(input.name ?? '').trim() || '未命名',
    calendar,
    month,
    day,
    remindDays,
    note: String(input.note ?? '')
  }
}

/** 未来若干天内的生日条目 */
export interface UpcomingBirthday {
  birthday: Birthday
  /** 下一次生日的公历日期 */
  date: string
  /** 距今天数（0 = 今天） */
  daysUntil: number
}

export const birthdayService = {
  list(): Birthday[] {
    const rows = getDb()
      .prepare('SELECT * FROM birthdays ORDER BY month ASC, day ASC, id ASC')
      .all()
    return rows.map(mapBirthday)
  },

  get(id: number): Birthday | null {
    const row = getDb().prepare('SELECT * FROM birthdays WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined
    return row ? mapBirthday(row) : null
  },

  /** 新增或更新生日（带 id 时为更新） */
  save(input: BirthdayInput): Birthday {
    const db = getDb()
    const data = normalize(input)
    if (input.id) {
      db.prepare(
        `UPDATE birthdays
            SET name = ?, calendar = ?, month = ?, day = ?, remind_days = ?, note = ?
          WHERE id = ?`
      ).run(data.name, data.calendar, data.month, data.day, data.remindDays, data.note, input.id)
      const updated = this.get(input.id)
      if (!updated) throw new Error('生日记录不存在')
      return updated
    }
    const res = db
      .prepare(
        `INSERT INTO birthdays (name, calendar, month, day, remind_days, note)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(data.name, data.calendar, data.month, data.day, data.remindDays, data.note)
    const created = this.get(Number(res.lastInsertRowid))
    if (!created) throw new Error('生日保存失败')
    return created
  },

  remove(id: number): void {
    getDb().prepare('DELETE FROM birthdays WHERE id = ?').run(id)
  },

  /** 未来 days 天内（含今天）的生日，按临近程度升序 */
  upcoming(days: number, today: string): UpcomingBirthday[] {
    return this.list()
      .map((birthday) => ({
        birthday,
        date: nextBirthdayDate(birthday, today) ?? '',
        daysUntil: daysUntilBirthday(birthday, today)
      }))
      .filter((item) => item.daysUntil >= 0 && item.daysUntil <= days)
      .sort((a, b) => a.daysUntil - b.daysUntil)
  }
}