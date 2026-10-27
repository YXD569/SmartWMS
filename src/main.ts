import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import './styles/variables.css'
import './styles/index.css'
import './styles/ruoyi.css'
import './styles/screen.css'

import App from './App.vue'
import router from './router'
import { permissionDirective } from './directives/permission'

const app = createApp(App)

// 注册全部 Element Plus 图标（后台图标密集，按需注册收益不高）
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn, size: 'default' })

// 按钮级权限指令 v-permission
app.directive('permission', permissionDirective)

app.mount('#app')
