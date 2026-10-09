/**
 * lunar-javascript 的最小类型声明（仅声明本项目用到的 API）。
 * 该库未随包提供 TypeScript 类型，这里按需声明以通过类型检查。
 */
declare module 'lunar-javascript' {
  /** 公历日期对象 */
  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar
    /** `YYYY-MM-DD` */
    toYmd(): string
    /** 公历节日（如「国庆节」「元旦」） */
    getFestivals(): string[]
    getLunar(): Lunar
  }

  /** 农历日期对象 */
  export class Lunar {
    static fromYmd(year: number, month: number, day: number): Lunar
    /** 农历年（数字） */
    getYear(): number
    /** 农历月（闰月为负数） */
    getMonth(): number
    /** 农历日 */
    getDay(): number
    /** 农历年干支（如「丙午」） */
    getYearInGanZhi(): string
    /** 农历月中文（如「八」「闰六」） */
    getMonthInChinese(): string
    /** 农历日中文（如「廿九」） */
    getDayInChinese(): string
    /** 节气名（非节气日返回空字符串） */
    getJieQi(): string
    /** 农历节日（如「春节」「除夕」「中秋节」） */
    getFestivals(): string[]
    getSolar(): Solar
  }

  /** 法定节假日 / 调休查询（库内置官方数据） */
  export class HolidayUtil {
    static getHoliday(date: string): Holiday | null
  }

  /** 单日节假日信息 */
  export class Holiday {
    getDay(): string
    getName(): string
    /** true = 调休上班 */
    isWork(): boolean
  }
}