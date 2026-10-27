import { defineStore } from 'pinia'
import { login, logout, getUserInfo } from '@/api/auth'
import { setTokens, clearTokens, getToken } from '@/utils/auth'
import type { LoginPayload, UserProfile } from '@/api/types'

interface UserState {
  token: string
  userId: number
  username: string
  nickname: string
  avatar: string
  dept: string
  roles: string[]
  /** 按钮级权限标识，如 wms:goods:add */
  permissions: string[]
  /** 数据权限：ALL 全部仓库 / WAREHOUSE 仅所属仓库 */
  dataScope: 'ALL' | 'WAREHOUSE'
  warehouseIds: number[]
}

export const useUserStore = defineStore('user', {
  state: (): UserState => ({
    token: getToken(),
    userId: 0,
    username: '',
    nickname: '',
    avatar: '',
    dept: '',
    roles: [],
    permissions: [],
    dataScope: 'ALL',
    warehouseIds: []
  }),
  getters: {
    isLogin: (s) => !!s.token
  },
  actions: {
    async login(payload: LoginPayload) {
      const data = await login(payload)
      setTokens(data.accessToken, data.refreshToken)
      this.token = data.accessToken
    },

    /** 拉取用户画像 + 角色 + 按钮权限 */
    async loadUserInfo() {
      const info = await getUserInfo()
      const u: UserProfile = info.user
      this.userId = u.id
      this.username = u.username
      this.nickname = u.nickname
      this.avatar = u.avatar
      this.dept = u.dept
      this.roles = info.roles || []
      this.permissions = info.permissions || []
      this.dataScope = u.dataScope
      this.warehouseIds = u.warehouseIds || []
      return info
    },

    async logout() {
      try {
        await logout()
      } catch {
        // 登出接口失败也要清理本地态，避免卡死
      }
      this.reset()
    },

    reset() {
      clearTokens()
      this.token = ''
      this.userId = 0
      this.username = ''
      this.nickname = ''
      this.roles = []
      this.permissions = []
      this.dataScope = 'ALL'
      this.warehouseIds = []
    }
  }
})
