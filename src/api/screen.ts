// 注意：这里导入的是封装后的 request（返回 data 部分），不是 axios 实例
import { request } from './request'
import type { ScreenData } from './types'

/** BI 大屏数据：一次拉取全量，后续靠 WebSocket 增量推送 */
export const screenApi = {
  overview: () => request<ScreenData>({ url: '/screen/overview' })
}

/** 大屏实时流水推送地址（WebSocket） */
export function flowWsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const base = (import.meta.env.VITE_API_BASE as string) || '/api'
  const host = import.meta.env.DEV ? '127.0.0.1:48081' : location.host
  return `${proto}://${host}${base}/screen/flow`
}
