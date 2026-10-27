<script setup lang="ts">
/**
 * 多级菜单的中间层容器
 * 后端下发的菜单树如果存在三级，中间层没有真实页面，用它承载 router-view
 */
defineOptions({ name: 'ParentView' })
</script>

<template>
  <RouterView />
</template>
