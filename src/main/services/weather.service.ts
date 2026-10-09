/**
 * 天气服务：IP 自动定位（ipwho.is，失败回退 ipapi.co 与内置默认城市）
 * + Open-Meteo 未来 7 天预报；结果缓存于 settings 表，断网时返回最近一次缓存。
 */
import { getDb } from '../db/database'
import {
  parseOpenMeteo,
  type WeatherPlace,
  type WeatherReport,
  type WeatherResult
} from '@shared/weather'

/** 缓存与定位在 settings 表中的键名 */
const CACHE_KEY = 'weather:cache'
const LOCATION_KEY = 'weather:location'
/** 缓存有效期：30 分钟 */
const CACHE_TTL_MS = 30 * 60 * 1000
/** 定位失败时的默认城市（北京） */
const DEFAULT_PLACE: WeatherPlace = { location: '北京（默认）', latitude: 39.9042, longitude: 116.4074 }
/** 预报天数（未来一周，含今天） */
const FORECAST_DAYS = 7

/* ------------------------------ settings 读写 ------------------------------ */

function readSetting(key: string): string | undefined {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value
}

function writeSetting(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(key, value)
}

/* ------------------------------ 网络请求 ------------------------------ */

async function fetchJson(url: string, timeoutMs = 8000): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** 读取缓存的定位信息 */
function cachedPlace(): WeatherPlace | null {
  const raw = readSetting(LOCATION_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as WeatherPlace
    if (parsed && parsed.latitude && parsed.longitude) return parsed
  } catch {
    // 缓存损坏时忽略
  }
  return null
}

/** IP 自动定位：ipwho.is → ipapi.co → 上次定位 → 默认城市 */
async function locate(): Promise<WeatherPlace> {
  try {
    const json = (await fetchJson('https://ipwho.is/')) as Record<string, unknown>
    const latitude = Number(json?.latitude)
    const longitude = Number(json?.longitude)
    if (json?.success !== false && Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return {
        location: String(json?.city || json?.region || '当前位置'),
        latitude,
        longitude
      }
    }
  } catch {
    // 继续尝试备用定位服务
  }
  try {
    const json = (await fetchJson('https://ipapi.co/json/')) as Record<string, unknown>
    const latitude = Number(json?.latitude)
    const longitude = Number(json?.longitude)
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { location: String(json?.city || json?.region || '当前位置'), latitude, longitude }
    }
  } catch {
    // 使用缓存或默认城市
  }
  return cachedPlace() ?? DEFAULT_PLACE
}

/* ------------------------------ 对外服务 ------------------------------ */

/** 读取缓存的天气报告（无缓存或损坏时返回 null） */
function readCache(): WeatherResult | null {
  const raw = readSetting(CACHE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as WeatherReport
    if (parsed && Array.isArray(parsed.days)) return parsed
  } catch {
    // 缓存损坏时忽略
  }
  return null
}

export const weatherService = {
  /**
   * 获取未来一周天气：默认 30 分钟内直接使用缓存；
   * force 为 true 时强制刷新；网络失败时回退到最近一次缓存（stale）。
   */
  async report(force = false): Promise<WeatherResult> {
    const cached = readCache()
    if (!force && cached && Date.now() - cached.updatedAtMs < CACHE_TTL_MS) return cached
    try {
      const place = await locate()
      writeSetting(LOCATION_KEY, JSON.stringify(place))
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}` +
        `&longitude=${place.longitude}` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=${FORECAST_DAYS}`
      const json = await fetchJson(url)
      const report = parseOpenMeteo(json, place)
      writeSetting(CACHE_KEY, JSON.stringify(report))
      return report
    } catch {
      if (cached) return { ...cached, stale: true }
      throw new Error('获取天气失败，请检查网络连接后重试')
    }
  }
}