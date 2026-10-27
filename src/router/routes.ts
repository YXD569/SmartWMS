import type { RouteRecordRaw } from 'vue-router'

/**
 * 常量路由：所有角色可见，不依赖后端下发
 * 动态路由由 permission store 在登录后 addRoute 注入 Layout 之下
 */
export const constantRoutes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { hidden: true, title: '登录' }
  },
  {
    path: '/bigscreen',
    name: 'BigScreen',
    component: () => import('@/views/screen/index.vue'),
    meta: { hidden: true, title: '仓储决策大屏' }
  },
  {
    path: '/404',
    name: 'NotFound',
    component: () => import('@/views/error/404.vue'),
    meta: { hidden: true, title: '页面不存在' }
  },
  {
    path: '/',
    // 命名 Layout：动态路由以 addRoute('Layout', route) 方式注入其下，
    // 子组件得以复用布局（vue-router 4 中绝对路径子路由仍保持嵌套关系）
    name: 'Layout',
    component: () => import('@/layouts/index.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '首页', icon: 'Odometer', affix: true }
      }
    ]
  }
]

export default constantRoutes
