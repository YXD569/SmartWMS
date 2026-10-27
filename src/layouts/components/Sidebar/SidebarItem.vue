<script setup lang="ts">
import type { RouteNode } from '@/api/types'

defineOptions({ name: 'SidebarItem' })

const props = defineProps<{ item: RouteNode }>()

/** 有子节点渲染为折叠分组，否则渲染为菜单项 */
function hasChildren(item: RouteNode): boolean {
  return !!(item.children && item.children.length)
}
</script>

<template>
  <el-sub-menu v-if="hasChildren(props.item)" :index="props.item.path">
    <template #title>
      <el-icon v-if="props.item.icon"><component :is="props.item.icon" /></el-icon>
      <span>{{ props.item.title }}</span>
    </template>
    <SidebarItem v-for="child in props.item.children" :key="child.id" :item="child" />
  </el-sub-menu>

  <el-menu-item v-else :index="props.item.path">
    <el-icon v-if="props.item.icon"><component :is="props.item.icon" /></el-icon>
    <template #title>{{ props.item.title }}</template>
  </el-menu-item>
</template>
