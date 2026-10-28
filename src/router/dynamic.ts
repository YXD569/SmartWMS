/**
 * 动态路由管理
 * 职责：统一维护「已注入路由名」清单，登出时逐个 removeRoute
 *
 * 背景（真实缺陷）：vue-router 4 的 addRoute 只在「同名重复添加」时替换，
 * 新菜单树中不存在的旧路由不会自动清理。切换账号时若只 reset store 不动 router，
 * 高权限账号注入的 /system/user 等路由会残留，低权限账号手敲地址仍可进入。
 */
import type { RouteRecordRaw, Router } from 'vue-router'

let routerRef: Router | null = null
/** 已注入的动态路由名（含中间层容器） */
const injected = new Set<string>()

/** 由路由守卫在初始化时注册 router 实例，避免 store 直接 import router 造成循环依赖 */
export function registerRouter(router: Router) {
  routerRef = router
}

/** 递归收集所有路由名：父级在前、子级在后 */
function collectNames(routes: RouteRecordRaw[], acc: string[] = []): string[] {
  routes.forEach((r) => {
    if (r.name != null) acc.push(String(r.name))
    if (r.children && r.children.length) collectNames(r.children, acc)
  })
  return acc
}

/** 把后端下发的路由树挂到命名路由 Layout 之下 */
export function addDynamicRoutes(router: Router, routes: RouteRecordRaw[]) {
  routes.forEach((r) => router.addRoute('Layout', r))
  collectNames(routes).forEach((n) => injected.add(n))
}

/** 登出 / 切换账号时清理，防止低权限账号越权访问残留页面 */
export function clearDynamicRoutes() {
  if (!routerRef) {
    injected.clear()
    return
  }
  // 逆序移除：先删子级再删父级，避免父级被移除后子级 removeRoute 失败
  Array.from(injected)
    .reverse()
    .forEach((name) => {
      if (routerRef!.hasRoute(name)) routerRef!.removeRoute(name)
    })
  injected.clear()
}
