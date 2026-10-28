/**
 * 路由守卫
 * 职责：登录校验 -> 拉取用户信息与动态路由 -> 注入路由 -> 放行
 * 注意：动态路由只注入一次，避免每次跳转重复 addRoute 触发警告
 */
import type { Router } from 'vue-router'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { usePermissionStore } from '@/stores/permission'
import { useTagsViewStore } from '@/stores/tagsView'
import { registerRouter, addDynamicRoutes } from '@/router/dynamic'

const WHITE_LIST = ['/login', '/404', '/bigscreen']

export function setupGuard(router: Router) {
  // 注册实例，供 permission store 在登出时清理动态路由
  registerRouter(router)

  router.beforeEach(async (to, _from, next) => {
    NProgress.start()
    const userStore = useUserStore()
    const permissionStore = usePermissionStore()
    const tagsStore = useTagsViewStore()

    // 白名单直接放行
    if (WHITE_LIST.includes(to.path)) {
      next()
      return
    }

    if (!userStore.isLogin) {
      ElMessage.warning('请先登录')
      next({ path: '/login', query: { redirect: to.fullPath } })
      return
    }

    // 首次进入：加载用户信息 + 动态路由
    if (!permissionStore.loaded) {
      try {
        await userStore.loadUserInfo()
        const routes = await permissionStore.generateRoutes()
        // 挂到命名路由 Layout 之下，保证页面复用侧边栏/导航布局
        addDynamicRoutes(router, routes)
        // addRoute 后需要重新进入一次，否则路由表尚未生效会 404
        next({ ...to, replace: true })
      } catch (e) {
        userStore.reset()
        ElMessage.error('获取用户信息失败，请重新登录')
        next({ path: '/login' })
      }
      return
    }

    // 路由已被清理（切换账号后旧路由被 removeRoute）或地址不存在 -> 跳 404，避免白屏
    if (!to.matched.length) {
      next({ path: '/404' })
      return
    }

    tagsStore.addView(to)
    next()
  })

  router.afterEach(() => {
    NProgress.done()
  })

  router.onError((err) => {
    NProgress.done()
    console.error('[router] 路由加载异常', err)
  })
}
