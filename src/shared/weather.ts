/**
 * 天气共享模块：WMO 天气码 → 中文描述与图标映射，
 * 以及 Open-Meteo 预报响应的解析（主进程服务与单元测试共用）。
 */

/** 单日天气预报 */
export interface WeatherDay {
  /** 日期（YYYY-MM-DD） */
  date: string
  /** WMO 天气码 */
  code: number
  /** 天气描述（中文） */
  text: string
  /** 天气图标（emoji） */
  icon: string
  /** 当日最高气温（℃） */
  tempMax: number
  /** 当日最低气温（℃） */
  tempMin: number
}

/** 天气报告（含定位信息与更新时间） */
export interface WeatherReport {
  /** 定位城市（如「Shanghai」/「北京（默认）」） */
  location: string
  latitude: number
  longitude: number
  /** 更新时间（本地时间文案，如「2026-10-09 13:05」） */
  updatedAt: string
  /** 更新时间戳（毫秒，用于缓存有效期判断） */
  updatedAtMs: number
  /** 未来若干天预报（今天起） */
  days: WeatherDay[]
}

/** 天气报告查询结果（stale 表示网络不可用、展示的是最近一次缓存） */
export interface WeatherResult extends WeatherReport {
  stale?: boolean
}

/** WMO 天气码 → 中文描述与图标 */
const WEATHER_CODES: Record<number, { text: string; icon: string }> = {
  0: { text: '晴', icon: '☀️' },
  1: { text: '晴间多云', icon: '🌤️' },
  2: { text: '多云', icon: '⛅' },
  3: { text: '阴', icon: '☁️' },
  45: { text: '雾', icon: '🌫️' },
  48: { text: '雾凇', icon: '🌫️' },
  51: { text: '毛毛雨', icon: '🌦️' },
  53: { text: '小雨', icon: '🌦️' },
  55: { text: '细雨', icon: '🌧️' },
  56: { text: '冻毛毛雨', icon: '🌧️' },
  57: { text: '冻雨', icon: '🌧️' },
  61: { text: '小雨', icon: '🌧️' },
  63: { text: '中雨', icon: '🌧️' },
  65: { text: '大雨', icon: '🌧️' },
  66: { text: '冻雨', icon: '🌧️' },
  67: { text: '强冻雨', icon: '🌧️' },
  71: { text: '小雪', icon: '🌨️' },
  73: { text: '中雪', icon: '🌨️' },
  75: { text: '大雪', icon: '❄️' },
  77: { text: '雪粒', icon: '🌨️' },
  80: { text: '阵雨', icon: '🌦️' },
  81: { text: '强阵雨', icon: '🌧️' },
  82: { text: '暴雨', icon: '⛈️' },
  85: { text: '阵雪', icon: '🌨️' },
  86: { text: '强阵雪', icon: '❄️' },
  95: { text: '雷阵雨', icon: '⛈️' },
  96: { text: '雷阵雨伴冰雹', icon: '⛈️' },
  99: { text: '强雷暴伴冰雹', icon: '⛈️' }
}

/** WMO 天气码 → 描述与图标（未知码回退「未知」） */
export function weatherOfCode(code: number): { text: string; icon: string } {
  return WEATHER_CODES[code] ?? { text: '未知', icon: '🌡️' }
}

/** Open-Meteo 预报响应（仅声明所需字段） */
export interface OpenMeteoResponse {
  daily?: {
    time?: string[]
    weather_code?: number[]
    temperature_2m_max?: number[]
    temperature_2m_min?: number[]
  }
}

/** 定位信息 */
export interface WeatherPlace {
  location: string
  latitude: number
  longitude: number
}

/** 本地时间文案（YYYY-MM-DD HH:mm） */
function timeLabel(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** 解析 Open-Meteo 预报响应为天气报告（数据不完整时按已有天数返回） */
export function parseOpenMeteo(json: unknown, place: WeatherPlace, now = new Date()): WeatherReport {
  const daily = (json as OpenMeteoResponse)?.daily
  const dates = daily?.time ?? []
  const codes = daily?.weather_code ?? []
  const maxs = daily?.temperature_2m_max ?? []
  const mins = daily?.temperature_2m_min ?? []
  const days: WeatherDay[] = []
  for (let i = 0; i < dates.length; i += 1) {
    const code = Number(codes[i])
    const tempMax = Number(maxs[i])
    const tempMin = Number(mins[i])
    if (!dates[i] || !Number.isFinite(code)) continue
    const info = weatherOfCode(code)
    days.push({
      date: dates[i],
      code,
      text: info.text,
      icon: info.icon,
      tempMax: Number.isFinite(tempMax) ? Math.round(tempMax) : 0,
      tempMin: Number.isFinite(tempMin) ? Math.round(tempMin) : 0
    })
  }
  return {
    location: place.location,
    latitude: place.latitude,
    longitude: place.longitude,
    updatedAt: timeLabel(now),
    updatedAtMs: now.getTime(),
    days
  }
}