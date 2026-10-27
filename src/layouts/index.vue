<script setup lang="ts">
import Sidebar from './components/Sidebar/index.vue'
import Navbar from './components/Navbar.vue'
import TagsView from './components/TagsView.vue'
import AppMain from './components/AppMain.vue'
import AiAssistant from '@/components/AiAssistant.vue'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
</script>

<template>
  <div class="app-wrapper" :class="{ collapsed: appStore.sidebarCollapsed }">
    <Sidebar class="sidebar-container" />
    <div class="main-container">
      <div class="fixed-header">
        <Navbar />
        <TagsView />
      </div>
      <AppMain />
    </div>
    <!-- AI 助手全局常驻，任意页面唤起，复用当前登录态与业务接口 -->
    <AiAssistant />
  </div>
</template>

<style scoped>
.app-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  background: var(--sw-app-bg);
}

.sidebar-container {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: var(--sw-sidebar-width);
  z-index: 1001;
  transition: width var(--sw-dur) var(--sw-ease-out);
  overflow: hidden;
}
.app-wrapper.collapsed .sidebar-container {
  width: var(--sw-sidebar-width-collapse);
}

.main-container {
  position: relative;
  min-height: 100%;
  margin-left: var(--sw-sidebar-width);
  transition: margin-left var(--sw-dur) var(--sw-ease-out);
}
.app-wrapper.collapsed .main-container {
  margin-left: var(--sw-sidebar-width-collapse);
}

.fixed-header {
  position: fixed;
  top: 0;
  right: 0;
  left: var(--sw-sidebar-width);
  z-index: 9;
  background: #fff;
  box-shadow: var(--sw-shadow-1);
  transition: left var(--sw-dur) var(--sw-ease-out);
}
.app-wrapper.collapsed .fixed-header {
  left: var(--sw-sidebar-width-collapse);
}

html.dark .fixed-header {
  background: var(--sw-navbar-bg, #1f1f1f);
}
</style>
