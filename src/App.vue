<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { ElConfigProvider } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { useAppStore } from '@/stores/app'
// AI 助手挂在 App 根上：大屏 /bigscreen 是顶层路由，不经过 Layout，
// 若只在 Layout 内挂载则大屏点击 KPI 卡唤起的 ai:explain-context 无人接收
import AiAssistant from '@/components/AiAssistant.vue'

const appStore = useAppStore()
const locale = zhCn

// 主题：dark 类挂在 html 上，CSS 变量整体切换
const isDark = computed(() => appStore.theme === 'dark')

onMounted(() => {
  // 卸载 index.html 的首屏骨架
  const boot = document.getElementById('boot-loading')
  if (boot) boot.remove()
})

function syncThemeClass(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark)
}
onMounted(() => syncThemeClass(isDark.value))
import { watch } from 'vue'
watch(isDark, (v) => syncThemeClass(v))
</script>

<template>
  <ElConfigProvider :locale="locale">
    <RouterView />
    <!-- 全局常驻：任意路由（含大屏、登录页）都可唤起 -->
    <AiAssistant />
  </ElConfigProvider>
</template>
