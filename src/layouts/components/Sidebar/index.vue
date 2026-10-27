<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePermissionStore } from '@/stores/permission'
import { useAppStore } from '@/stores/app'
import SidebarItem from './SidebarItem.vue'

const route = useRoute()
const router = useRouter()
const permissionStore = usePermissionStore()
const appStore = useAppStore()

const menus = computed(() => permissionStore.menus)
const activePath = computed(() => route.path)

/** 菜单点击：直接跳完整路径（后端下发的是绝对路径） */
function handleSelect(path: string) {
  if (path && path !== route.path) router.push(path)
}

/** 大屏入口：独立于 Layout 的全屏路由 */
function goBigScreen() {
  router.push('/bigscreen')
}
</script>

<template>
  <div class="sidebar">
    <div class="logo" @click="router.push('/dashboard')">
      <span class="mark">WMS</span>
      <span v-show="!appStore.sidebarCollapsed" class="name">智联仓储</span>
    </div>

    <!-- 大屏快捷入口，与业务菜单区分开 -->
    <div class="screen-entry" @click="goBigScreen">
      <el-icon><DataAnalysis /></el-icon>
      <span v-show="!appStore.sidebarCollapsed">决策大屏</span>
    </div>

    <el-scrollbar class="menu-scroll">
      <el-menu
        :default-active="activePath"
        :collapse="appStore.sidebarCollapsed"
        :collapse-transition="false"
        background-color="#001529"
        text-color="#bfcbd9"
        active-text-color="#ffffff"
        unique-opened
        @select="handleSelect"
      >
        <SidebarItem v-for="menu in menus" :key="menu.id" :item="menu" />
      </el-menu>
    </el-scrollbar>
  </div>
</template>

<style scoped>
.sidebar {
  height: 100%;
  background: var(--sw-sidebar-bg);
  display: flex;
  flex-direction: column;
}

.logo {
  height: var(--sw-navbar-height);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  cursor: pointer;
  background: var(--sw-sidebar-bg-sub);
  flex: 0 0 auto;
}
.logo .mark {
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--sw-primary);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  border-radius: 3px;
  letter-spacing: 0.5px;
}
.logo .name {
  color: #fff;
  font-size: 15px;
  font-weight: 500;
  white-space: nowrap;
  letter-spacing: 1px;
}

.screen-entry {
  margin: 8px;
  padding: 9px 12px;
  border-radius: 3px;
  background: rgba(35, 215, 255, 0.10);
  border: 1px solid rgba(35, 215, 255, 0.26);
  color: #23d7ff;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  flex: 0 0 auto;
  white-space: nowrap;
  transition: background var(--sw-dur-fast);
}
.screen-entry:hover {
  background: rgba(35, 215, 255, 0.20);
}

.menu-scroll {
  flex: 1;
  min-height: 0;
}

:deep(.el-menu) {
  border-right: none;
}
:deep(.el-menu-item.is-active) {
  background: var(--sw-primary) !important;
}
:deep(.el-menu-item:hover),
:deep(.el-sub-menu__title:hover) {
  background: var(--sw-sidebar-hover) !important;
}
:deep(.el-menu--collapse) {
  width: var(--sw-sidebar-width-collapse);
}
</style>
