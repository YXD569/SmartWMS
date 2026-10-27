/**
 * 双 Token 存储
 * accessToken 短时效（30 分钟），refreshToken 长时效（7 天）
 * 生产环境建议 refreshToken 放 HttpOnly Cookie，这里为演示可读性放 localStorage
 */
const ACCESS_KEY = 'smartwms_access_token'
const REFRESH_KEY = 'smartwms_refresh_token'

export function getToken(): string {
  return localStorage.getItem(ACCESS_KEY) || ''
}

export function getRefreshToken(): string {
  return localStorage.getItem(REFRESH_KEY) || ''
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_KEY, accessToken)
  localStorage.setItem(REFRESH_KEY, refreshToken)
}

export function setToken(accessToken: string): void {
  localStorage.setItem(ACCESS_KEY, accessToken)
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

export function isLogin(): boolean {
  return !!getToken()
}
