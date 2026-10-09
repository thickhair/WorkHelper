/**
 * 天气共享模块单元测试：WMO 天气码映射与 Open-Meteo 响应解析。
 */
import { describe, expect, it } from 'vitest'
import { parseOpenMeteo, weatherOfCode } from '@shared/weather'

describe('天气模块', () => {
  it('WMO 天气码映射为中文描述与图标', () => {
    expect(weatherOfCode(0)).toEqual({ text: '晴', icon: '☀️' })
    expect(weatherOfCode(3).text).toBe('阴')
    expect(weatherOfCode(61).text).toBe('小雨')
    expect(weatherOfCode(95).text).toBe('雷阵雨')
  })

  it('未知天气码回退为「未知」', () => {
    expect(weatherOfCode(123)).toEqual({ text: '未知', icon: '🌡️' })
  })

  it('解析 Open-Meteo 响应为多日预报并四舍五入气温', () => {
    const json = {
      daily: {
        time: ['2026-10-09', '2026-10-10'],
        weather_code: [3, 61],
        temperature_2m_max: [25.8, 20.2],
        temperature_2m_min: [13.8, 11.5]
      }
    }
    const report = parseOpenMeteo(
      json,
      { location: 'Shanghai', latitude: 31.2, longitude: 121.4 },
      new Date(2026, 9, 9, 13, 5)
    )

    expect(report.location).toBe('Shanghai')
    expect(report.updatedAt).toBe('2026-10-09 13:05')
    expect(report.latitude).toBe(31.2)
    expect(report.days).toHaveLength(2)
    expect(report.days[0]).toMatchObject({ date: '2026-10-09', text: '阴', tempMax: 26, tempMin: 14 })
    expect(report.days[1]).toMatchObject({ date: '2026-10-10', text: '小雨', tempMax: 20, tempMin: 12 })
  })

  it('响应数据缺失时返回空列表而不抛错', () => {
    const empty = parseOpenMeteo({}, { location: '北京（默认）', latitude: 39.9, longitude: 116.4 })
    expect(empty.days).toEqual([])

    const partial = parseOpenMeteo(
      { daily: { time: ['2026-10-09'] } },
      { location: 'x', latitude: 0, longitude: 0 }
    )
    expect(partial.days).toEqual([])
  })
})