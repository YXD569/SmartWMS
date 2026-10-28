import { describe, it, expect, beforeEach } from 'vitest'
import { createRouter, createMemoryHistory, type RouteRecordRaw } from 'vue-router'
import { registerRouter, addDynamicRoutes, clearDynamicRoutes } from './dynamic'

/**
 * 回归测试：切换账号时动态路由必须被清理
 * 背景缺陷：vue-router 的 addRoute 只在同名重加时替换，旧菜单树里的
 * /system/user 会残留，低权限账号手敲地址即可越权进入系统管理页
 */
function page(name: string) {
  return { name, path: name.toLowerCase(), component: { render: () => null } } as RouteRecordRaw
}
function group(name: string, children: RouteRecordRaw[]) {
  return { name, path: name.toLowerCase(), component: { render: () => null }, children } as RouteRecordRaw
}

const LAYOUT = {
  name: 'Layout',
  path: '/',
  component: { render: () => null },
  children: [{ path: 'dashboard', name: 'Dashboard', component: { render: () => null } }]
} as RouteRecordRaw

function makeRouter() {
  const r = createRouter({ history: createMemoryHistory(), routes: [LAYOUT] })
  registerRouter(r)
  return r
}

/** admin 的菜单树：基础数据 + 系统管理 */
const ADMIN_TREE = [group('Base', [page('Goods')]), group('System', [page('User')])]
/** stock 的菜单树：只有基础数据 */
const STOCK_TREE = [group('Base', [page('Goods')])]

describe('动态路由清理', () => {
  let router: ReturnType<typeof makeRouter>

  beforeEach(() => {
    router = makeRouter()
    // 确保每个用例从干净状态开始
    clearDynamicRoutes()
  })

  it('注入后可正常解析管理员页面', () => {
    addDynamicRoutes(router, ADMIN_TREE)
    expect(router.resolve('/system/user').name).toBe('User')
    expect(router.resolve('/base/goods').name).toBe('Goods')
  })

  it('清理后再注入低权限菜单，管理员页面不可解析（越权修复）', () => {
    addDynamicRoutes(router, ADMIN_TREE)
    // 模拟登出：旧实现只 reset store，这里必须真正摘掉路由
    clearDynamicRoutes()
    addDynamicRoutes(router, STOCK_TREE)

    const resolved = router.resolve('/system/user')
    expect(resolved.matched.length).toBe(0)
    expect(router.getRoutes().map((r) => String(r.name))).not.toContain('User')
  })

  it('清理不误删常量路由', () => {
    addDynamicRoutes(router, ADMIN_TREE)
    clearDynamicRoutes()
    expect(router.hasRoute('Layout')).toBe(true)
    expect(router.hasRoute('Dashboard')).toBe(true)
    expect(router.resolve('/dashboard').name).toBe('Dashboard')
  })
})
