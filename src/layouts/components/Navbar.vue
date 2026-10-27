<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useUserStore } from '@/stores/user'
import { usePermissionStore } from '@/stores/permission'

const router = useRouter()
const route = useRoute()
const appStore = useAppStore()
const userStore = useUserStore()
const permissionStore = usePermissionStore()

/** 面包屑：基于 matched 生成 */
const breadcrumbs = computed(() => {
  return route.matched
    .filter((r) => r.meta && r.meta.title && r.meta.title !== '首页')
    .map((r) => ({ title: r.meta.title as string, path: r.path }))
})

const isFullscreen = ref(false)

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen()
    isFullscreen.value = false
  } else {
    document.documentElement.requestFullscreen()
    isFullscreen.value = true
  }
}

async function handleCommand(cmd: string) {
  if (cmd === 'profile') {
    router.push('/dashboard')
  } else if (cmd === 'logout') {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', { type: 'warning' })
    await userStore.logout()
    permissionStore.reset()
    router.push('/login')
  }
}
</script>

<template>
  <div class="navbar">
    <div class="left">
      <el-icon class="icon-btn" @click="appStore.toggleSidebar()">
        <component :is="appStore.sidebarCollapsed ? 'Expand' : 'Fold'" />
      </el-icon>
      <el-breadcrumb separator="/" class="crumbs">
        <el-breadcrumb-item :to="{ path: '/dashboard' }">首页</el-breadcrumb-item>
        <el-breadcrumb-item v-for="b in breadcrumbs" :key="b.path">{{ b.title }}</el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="right">
      <!-- AI 助手入口：全局唤起 -->
      <el-tooltip content="AI 助手" placement="bottom">
        <el-icon class="icon-btn ai-btn" @click="appStore.toggleAiPanel()"><ChatDotRound /></el-icon>
      </el-tooltip>

      <el-tooltip :content="isFullscreen ? '退出全屏' : '全屏'" placement="bottom">
        <el-icon class="icon-btn" @click="toggleFullscreen"><FullScreen /></el-icon>
      </el-tooltip>

      <el-tooltip :content="appStore.theme === 'dark' ? '切换亮色' : '切换暗色'" placement="bottom">
        <el-icon class="icon-btn" @click="appStore.toggleTheme()">
          <component :is="appStore.theme === 'dark' ? 'Sunny' : 'Moon'" />
        </el-icon>
      </el-tooltip>

      <el-dropdown trigger="click" @command="handleCommand">
        <div class="user">
          <span class="avatar">{{ (userStore.nickname || 'U').slice(0, 1) }}</span>
          <span class="name">{{ userStore.nickname || '未登录' }}</span>
          <el-icon><ArrowDown /></el-icon>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="profile">个人中心</el-dropdown-item>
            <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<style scoped>
.navbar {
  height: var(--sw-navbar-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
}
.left { display: flex; align-items: center; gap: 10px; min-width: 0; }
.right { display: flex; align-items: center; gap: 4px; }

.icon-btn {
  font-size: 17px;
  padding: 7px;
  cursor: pointer;
  border-radius: var(--sw-radius);
  color: var(--sw-text-2);
  transition: all var(--sw-dur-fast);
}
.icon-btn:hover { background: var(--sw-fill); color: var(--sw-primary); }
.ai-btn { color: var(--sw-primary); }

.crumbs { font-size: 13px; }

.user {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: var(--sw-radius);
  outline: none;
}
.user:hover { background: var(--sw-fill); }
.user .avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--sw-primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
}
.user .name { font-size: 13px; color: var(--sw-text-2); }
</style>
