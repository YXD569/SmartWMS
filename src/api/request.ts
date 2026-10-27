/**
 * 请求层封装
 * ------------------------------------------------------------------
 * 1. 统一 baseURL、超时、错误码映射
 * 2. 自动携带 accessToken
 * 3. 双 Token 无感刷新：401 时挂起并发请求 -> 刷新 -> 重放，业务层零感知
 * 4. 重复请求取消（同一 URL+参数的 GET 在途时取消前一个）
 * 5. 全局 loading 计数，供 NProgress 使用
 */
import axios, { type AxiosInstance, type InternalAxiosRequestConfig, AxiosError } from 'axios'
import { ElMessage } from 'element-plus'
import { getToken, getRefreshToken, setTokens, clearTokens } from '@/utils/auth'

export interface ApiResult<T = any> {
  code: number
  data: T
  msg: string
}

const baseURL = (import.meta.env.VITE_API_BASE as string) || '/api'

const service: AxiosInstance = axios.create({
  baseURL,
  timeout: 30000
})

/** 在途请求映射，用于取消重复请求 */
const pendingMap = new Map<string, AbortController>()

function requestKey(config: InternalAxiosRequestConfig): string {
  return [config.method, config.url, JSON.stringify(config.params || {}), JSON.stringify(config.data || {})].join('|')
}

function addPending(config: InternalAxiosRequestConfig) {
  const key = requestKey(config)
  if (pendingMap.has(key)) {
    pendingMap.get(key)?.abort()
    pendingMap.delete(key)
  }
  const controller = new AbortController()
  config.signal = controller.signal
  pendingMap.set(key, controller)
}

function removePending(config: InternalAxiosRequestConfig) {
  const key = requestKey(config)
  pendingMap.delete(key)
}

// ---------- 请求拦截 ----------
service.interceptors.request.use(
  (config) => {
    addPending(config)
    const token = getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ---------- 双 Token 无感刷新 ----------
let isRefreshing = false
/** 刷新期间被挂起的请求队列 */
const waitQueue: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = []

function onRefreshed() {
  waitQueue.forEach((p) => p.resolve(undefined))
  waitQueue.length = 0
}

function onRefreshFailed(err: unknown) {
  waitQueue.forEach((p) => p.reject(err))
  waitQueue.length = 0
}

async function doRefresh(): Promise<string> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) throw new Error('NO_REFRESH_TOKEN')
  // 用裸 axios 发起，避免走自身拦截器造成循环
  const res = await axios.post<ApiResult<{ accessToken: string; refreshToken: string }>>(
    `${baseURL}/auth/refresh`,
    { refreshToken }
  )
  const body = res.data
  if (body.code !== 200 || !body.data?.accessToken) throw new Error(body.msg || 'REFRESH_FAILED')
  setTokens(body.data.accessToken, body.data.refreshToken)
  return body.data.accessToken
}

// ---------- 响应拦截 ----------
service.interceptors.response.use(
  (response) => {
    removePending(response.config)
    const res = response.data as ApiResult
    // blob / 非标准结构直接放行
    if (!res || typeof res.code === 'undefined') return response.data
    if (res.code === 200) return res.data
    ElMessage.error(res.msg || '请求失败')
    return Promise.reject(new Error(res.msg || '请求失败'))
  },
  async (error: AxiosError<ApiResult>) => {
    const config = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    if (config) removePending(config)

    // 主动取消不提示
    if (axios.isCancel(error) || (error as any).name === 'CanceledError') {
      return Promise.reject(error)
    }

    const status = error.response?.status
    const data = error.response?.data

    // 401：尝试无感刷新
    if (status === 401 && config && !config._retry && !config.url?.includes('/auth/refresh')) {
      if (isRefreshing) {
        // 并发请求挂起，等刷新完成后重放
        return new Promise((resolve, reject) => {
          waitQueue.push({ resolve, reject })
        }).then(() => service.request(config))
      }
      config._retry = true
      isRefreshing = true
      try {
        await doRefresh()
        isRefreshing = false
        onRefreshed()
        return service.request(config)
      } catch (e) {
        isRefreshing = false
        onRefreshFailed(e)
        clearTokens()
        ElMessage.error('登录已过期，请重新登录')
        window.location.href = '/login'
        return Promise.reject(e)
      }
    }

    const msg = (data && data.msg) || error.message || '网络异常'
    if (status !== 401) ElMessage.error(msg)
    return Promise.reject(error)
  }
)

/** 通用请求方法（返回 data 部分） */
export function request<T = any>(config: Parameters<AxiosInstance['request']>[0]): Promise<T> {
  return service.request(config) as unknown as Promise<T>
}

export default service
