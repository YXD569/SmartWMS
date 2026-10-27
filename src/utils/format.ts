/** 通用格式化：金额、数量、时间、百分比 */

/** 千分位金额，默认两位小数 */
export function money(value: number | string | null | undefined, digits = 2): string {
  if (value === null || value === undefined || value === '') return '-'
  const n = Number(value)
  if (Number.isNaN(n)) return '-'
  return n.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/** 整数千分位 */
export function number(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-'
  const n = Number(value)
  if (Number.isNaN(n)) return '-'
  return n.toLocaleString('zh-CN')
}

/** 紧凑数字：12345 -> 1.2万 */
export function compact(value: number | string | null | undefined): string {
  const n = Number(value)
  if (Number.isNaN(n)) return '-'
  const abs = Math.abs(n)
  if (abs >= 100000000) return (n / 100000000).toFixed(2) + '亿'
  if (abs >= 10000) return (n / 10000).toFixed(1) + '万'
  return String(Math.round(n))
}

/** 百分比，入参为小数（0.1234 -> 12.34%） */
export function percent(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return '-'
  const n = Number(value)
  if (Number.isNaN(n)) return '-'
  return (n * 100).toFixed(digits) + '%'
}

/** 日期时间补零 */
function pad(n: number): string {
  return n < 10 ? '0' + n : String(n)
}

export function datetime(input: string | number | Date | null | undefined): string {
  if (!input) return '-'
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return '-'
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function date(input: string | number | Date | null | undefined): string {
  if (!input) return '-'
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return '-'
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 时间 HH:mm:ss */
export function time(input: string | number | Date | null | undefined): string {
  if (!input) return '-'
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return '-'
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 脱敏：手机号/姓名，AI 模块输出前使用 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone
  return phone.slice(0, 3) + '****' + phone.slice(-4)
}

export function maskName(name: string): string {
  if (!name) return name
  if (name.length <= 1) return name
  return name[0] + '*'.repeat(name.length - 1)
}
