import { createRouter, createWebHistory } from 'vue-router'
import { constantRoutes } from './routes'
import { setupGuard } from './guard'

const router = createRouter({
  history: createWebHistory(),
  routes: constantRoutes,
  // 路由切换后回到顶部，后台列表页体验更稳定
  scrollBehavior: () => ({ top: 0 })
})

setupGuard(router)

export default router
