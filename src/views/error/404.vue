<script setup lang="ts">
import { useRouter } from 'vue-router'
const router = useRouter()
</script>

<template>
  <div class="notfound">
    <div class="code">404</div>
    <h2>页面走丢了</h2>
    <p class="msg">你访问的页面不存在，或你没有该页面的访问权限</p>
    <div class="ops">
      <el-button type="primary" @click="router.push('/dashboard')">返回首页</el-button>
      <el-button @click="router.back()">返回上一页</el-button>
    </div>
  </div>
</template>

<style scoped>
.notfound {
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--sw-app-bg);
  gap: 6px;
}
.code {
  font-size: 96px;
  font-weight: 700;
  letter-spacing: 6px;
  color: var(--sw-primary);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
h2 { font-size: 19px; font-weight: 600; margin: 8px 0 0; color: var(--sw-text-1); }
.msg { font-size: 13.5px; color: var(--sw-text-3); margin: 0 0 18px; }
.ops { display: flex; gap: 10px; }
</style>
