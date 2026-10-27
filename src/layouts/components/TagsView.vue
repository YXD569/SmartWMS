<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTagsViewStore } from '@/stores/tagsView'

const route = useRoute()
const router = useRouter()
const tagsStore = useTagsViewStore()

const visited = computed(() => tagsStore.visited)

function isActive(tag: { fullPath: string }) {
  return tag.fullPath === route.fullPath
}

function closeTag(tag: any) {
  const removed = tagsStore.delView(tag)
  if (isActive(tag) && removed.length) {
    const last = tagsStore.visited[tagsStore.visited.length - 1]
    router.push(last ? last.fullPath : '/dashboard')
  }
}

function closeOthers() {
  tagsStore.delOthers(route)
}

function closeAll() {
  tagsStore.delAll()
  router.push('/dashboard')
}

// 首屏补一个首页标签
watch(
  () => route.fullPath,
  () => tagsStore.addView(route),
  { immediate: true }
)
</script>

<template>
  <div class="tags-view">
    <el-scrollbar class="scroll">
      <div class="tags">
        <span
          v-for="tag in visited"
          :key="tag.fullPath"
          class="tag"
          :class="{ active: isActive(tag) }"
          @click="router.push(tag.fullPath)"
        >
          {{ tag.title }}
          <el-icon v-if="!tag.affix" class="close" @click.stop="closeTag(tag)"><Close /></el-icon>
        </span>
      </div>
    </el-scrollbar>

    <el-dropdown trigger="click" class="more">
      <el-icon class="more-btn"><ArrowDown /></el-icon>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item @click="tagsStore.addView(route)">刷新当前</el-dropdown-item>
          <el-dropdown-item @click="closeOthers">关闭其他</el-dropdown-item>
          <el-dropdown-item @click="closeAll">关闭全部</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<style scoped>
.tags-view {
  height: var(--sw-tagsview-height);
  display: flex;
  align-items: center;
  border-top: 1px solid var(--sw-border-3);
  background: #fff;
  padding-right: 8px;
}
html.dark .tags-view { background: var(--sw-navbar-bg, #1f1f1f); border-top-color: var(--sw-border-2); }

.scroll { flex: 1; min-width: 0; }
.tags { display: flex; align-items: center; gap: 5px; padding: 0 8px; height: 100%; }

.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 23px;
  padding: 0 8px;
  font-size: 12px;
  border: 1px solid var(--sw-border-2);
  border-radius: 2px;
  color: var(--sw-text-2);
  cursor: pointer;
  white-space: nowrap;
  background: #fff;
  flex: 0 0 auto;
}
.tag:hover { color: var(--sw-primary); }
.tag.active {
  background: var(--sw-primary);
  border-color: var(--sw-primary);
  color: #fff;
}
.tag.active .close:hover { background: rgba(255, 255, 255, 0.3); }
.close {
  font-size: 11px;
  border-radius: 50%;
  padding: 1px;
}
.close:hover { background: var(--sw-border-2); }

.more-btn {
  font-size: 14px;
  padding: 6px;
  cursor: pointer;
  color: var(--sw-text-2);
  outline: none;
}
</style>
