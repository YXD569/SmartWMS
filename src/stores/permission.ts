import { defineStore } from 'pinia'
import type { RouteRecordRaw } from 'vue-router'
import { getRoutes } from '@/api/auth'
import type { RouteNode } from '@/api/types'
import { constantRoutes } from '@/router/routes'
import { clearDynamicRoutes } from '@/router/dynamic'

/**
 * 扫描 src/views 下所有 .vue，用于后端返回 component 字符串时动态映射
 * key 形如 /src/views/base/Goods.vue
 */
const viewModules = import.meta.glob('/src/views/**/*.vue')

function resolveComponent(componentPath: string) {
  const key = `/src/views/${componentPath.replace(/^\/?/, '')}`
  const loader = viewModules[key]
  if (!loader) {
    console.warn(`[permission] 未找到组件：${key}，已回退到 404`)
    return viewModules['/src/views/error/404.vue']
  }
  return loader
}

/**
 * 后端路由树 -> vue-router 路由记录
 * 关键点：子路由必须相对父路径，否则嵌套路由会被解析成根路径导致 Layout 失配
 */
function transform(nodes: RouteNode[], parentPath = ''): RouteRecordRaw[] {
  const routes: RouteRecordRaw[] = []
  nodes.forEach((node) => {
    const rawPath = node.path.startsWith('/') ? node.path : `/${node.path}`
    // 子级路径去掉父级前缀，转成相对路径
    let path = rawPath
    if (parentPath && rawPath.startsWith(parentPath + '/')) {
      path = rawPath.slice(parentPath.length + 1)
    } else if (parentPath && rawPath === parentPath) {
      path = ''
    }

    const children = node.children && node.children.length ? transform(node.children, rawPath) : []
    // 有子节点且自身无组件 -> 中间层容器
    const isParent = !node.component && children.length > 0

    const route: RouteRecordRaw = {
      path: path || rawPath,
      name: node.name,
      meta: {
        title: node.title,
        icon: node.icon,
        permissions: node.permissions || [],
        // 只有叶子页面参与缓存：中间层容器无组件，进 include 会让 include 匹配落空。
        // 这里的 name 与视图 defineOptions({ name }) 一致，KeepAlive 才能按名命中
        keepAlive: !!node.component
      },
      children: children.length ? children : undefined,
      component: isParent
        ? () => import('@/layouts/components/ParentView.vue')
        : node.component
          ? resolveComponent(node.component)
          : undefined
    } as RouteRecordRaw

    routes.push(route)
  })
  return routes
}

interface PermissionState {
  /** 后端下发的路由树（原始） */
  rawRoutes: RouteNode[]
  /** 转换后的动态路由 */
  dynamicRoutes: RouteRecordRaw[]
  loaded: boolean
}

export const usePermissionStore = defineStore('permission', {
  state: (): PermissionState => ({
    rawRoutes: [],
    dynamicRoutes: [],
    loaded: false
  }),
  getters: {
    /** 侧边栏菜单数据源 */
    menus: (s) => s.rawRoutes
  },
  actions: {
    async generateRoutes(): Promise<RouteRecordRaw[]> {
      const tree = await getRoutes()
      this.rawRoutes = tree
      this.dynamicRoutes = transform(tree)
      this.loaded = true
      return this.dynamicRoutes
    },
    reset() {
      // 必须先摘掉已注入的路由，否则切换账号时高权限路由会残留导致越权
      clearDynamicRoutes()
      this.rawRoutes = []
      this.dynamicRoutes = []
      this.loaded = false
    }
  }
})

export { constantRoutes }
