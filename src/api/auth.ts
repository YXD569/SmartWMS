// 注意：这里导入的是封装后的 request（返回 data 部分），不是 axios 实例
import { request } from './request'
import type { LoginPayload, TokenPair, UserInfo, RouteNode, UserProfile, PageResult, PageQuery } from './types'

/** 登录 */
export function login(data: LoginPayload) {
  return request<TokenPair>({ url: '/auth/login', method: 'post', data })
}

/** 刷新 Token（无感刷新内部调用，业务层一般不用） */
export function refresh(refreshToken: string) {
  return request<TokenPair>({ url: '/auth/refresh', method: 'post', data: { refreshToken } })
}

/** 当前用户信息：含角色与按钮权限 */
export function getUserInfo() {
  return request<UserInfo>({ url: '/auth/user-info', method: 'get' })
}

/** 动态路由表 */
export function getRoutes() {
  return request<RouteNode[]>({ url: '/auth/routes', method: 'get' })
}

export function logout() {
  return request<null>({ url: '/auth/logout', method: 'post' })
}

// ---------------- 系统管理 ----------------
export function getUserList(params: PageQuery) {
  return request<PageResult<UserProfile>>({ url: '/system/user/list', method: 'get', params })
}

export function getRoleList() {
  return request<any[]>({ url: '/system/role/list', method: 'get' })
}

export function getMenuList() {
  return request<RouteNode[]>({ url: '/system/menu/list', method: 'get' })
}
