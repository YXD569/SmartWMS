import { describe, it, expect } from 'vitest'
import { money, number, compact, percent, datetime, date, time, maskPhone, maskName } from './format'

describe('格式化工具', () => {
  it('金额千分位并保留两位小数', () => {
    expect(money(1234.5)).toBe('1,234.50')
    expect(money(1234567.891, 2)).toBe('1,234,567.89')
  })

  it('空值统一显示为占位符，避免页面出现 NaN', () => {
    expect(money(null)).toBe('-')
    expect(number(undefined)).toBe('-')
    expect(percent(null)).toBe('-')
    expect(money('abc')).toBe('-')
  })

  it('紧凑数字按万/亿降级', () => {
    expect(compact(9999)).toBe('9999')
    expect(compact(12345)).toBe('1.2万')
    expect(compact(123456789)).toBe('1.23亿')
  })

  it('百分比入参为小数', () => {
    expect(percent(0.1234)).toBe('12.34%')
    expect(percent(-0.05, 1)).toBe('-5.0%')
  })

  it('时间格式化补零', () => {
    expect(date('2026-03-05T12:00:00')).toBe('2026-03-05')
    expect(time('2026-03-05T09:08:07')).toBe('09:08:07')
    expect(datetime('2026-03-05T09:08:07')).toBe('2026-03-05 09:08:07')
    expect(datetime('not-a-date')).toBe('-')
  })

  it('脱敏只保留首尾', () => {
    expect(maskPhone('13812345678')).toBe('138****5678')
    expect(maskName('张三丰')).toBe('张**')
  })
})
