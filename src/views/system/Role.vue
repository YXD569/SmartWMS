<script setup lang="ts">
/**
 * 角色与权限
 * 展示 RBAC 的授权结果：角色 -> 菜单 -> 按钮权限，直观体现权限模型的落地形态
 */
import { ref, computed, onMounted } from 'vue'
import { getRoleList, getUserInfo } from '@/api/auth'

defineOptions({ name: 'SystemRole' })

const roles = ref<any[]>([])
const activeRole = ref<string>('')
const loading = ref(false)
/** 当前登录用户的权限全集，用于标记哪些权限已生效 */
const myPerms = ref<string[]>([])

const currentRole = computed(() => roles.value.find((r) => r.code === activeRole.value))

async function load() {
  loading.value = true
  try {
    roles.value = await getRoleList()
    if (roles.value.length && !activeRole.value) activeRole.value = roles.value[0].code
    const info = await getUserInfo()
    myPerms.value = info.permissions || []
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div v-loading="loading" class="app-container">
    <div class="role-layout">
      <!-- 角色列表 -->
      <el-card class="table-card role-list" shadow="never">
        <div class="panel-title">角色</div>
        <div
          v-for="r in roles"
          :key="r.code"
          class="role-item"
          :class="{ active: activeRole === r.code }"
          @click="activeRole = r.code"
        >
          <div class="rname">{{ r.name }}</div>
          <div class="rcode">{{ r.code }}</div>
          <div class="rdesc">{{ r.desc }}</div>
        </div>
      </el-card>

      <!-- 权限明细 -->
      <el-card class="table-card" shadow="never">
        <div class="panel-title">
          {{ currentRole?.name || '角色' }} 的权限
          <span class="muted">（{{ currentRole?.permissions?.length || 0 }} 项）</span>
        </div>

        <el-alert
          type="info"
          :closable="false"
          title="权限说明"
          description="按钮级权限通过 v-permission 指令控制，无权限时按钮直接从 DOM 移除；菜单级权限由后端下发路由树，前端不会加载对应页面组件。"
          show-icon
          style="margin-bottom: 14px"
        />

        <div class="perm-grid">
          <span v-for="p in currentRole?.permissions || []" :key="p" class="perm" :class="{ on: myPerms.includes(p) }">
            {{ p }}
          </span>
        </div>

        <div v-if="currentRole?.dataScope" class="scope">
          数据权限：
          <el-tag :type="currentRole.dataScope === 'ALL' ? 'success' : 'warning'" size="small">
            {{ currentRole.dataScope === 'ALL' ? '全部仓库数据' : '仅所属仓库数据' }}
          </el-tag>
        </div>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.role-layout { display: grid; grid-template-columns: 260px 1fr; gap: 14px; align-items: start; }
.panel-title { font-size: 14px; font-weight: 600; margin-bottom: 10px; }
.muted { color: var(--sw-text-3); font-weight: 400; font-size: 12px; }

.role-item {
  padding: 10px 12px;
  border-radius: var(--sw-radius);
  cursor: pointer;
  border: 1px solid transparent;
  transition: all var(--sw-dur-fast);
}
.role-item:hover { background: var(--sw-fill); }
.role-item.active { background: var(--sw-primary-light); border-color: var(--sw-primary); }
.role-item .rname { font-size: 14px; font-weight: 500; }
.role-item .rcode { font-size: 12px; color: var(--sw-text-3); font-family: monospace; }
.role-item .rdesc { font-size: 12px; color: var(--sw-text-3); margin-top: 2px; }

.perm-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.perm {
  font-size: 12px;
  padding: 3px 8px;
  border-radius: 3px;
  background: var(--sw-fill);
  color: var(--sw-text-3);
  font-family: monospace;
}
.perm.on { background: var(--sw-primary-light); color: var(--sw-primary); }

.scope { margin-top: 16px; font-size: 13px; color: var(--sw-text-2); }

@media (max-width: 1000px) {
  .role-layout { grid-template-columns: 1fr; }
}
</style>
