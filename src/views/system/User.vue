<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { getUserList } from '@/api/auth'
import CrudPage, { type FormField } from '@/components/CrudPage.vue'
import type { ProColumn } from '@/components/ProTable.vue'

defineOptions({ name: 'SystemUser' })

const columns: ProColumn[] = [
  { label: '账号', prop: 'username', width: 130 },
  { label: '姓名', prop: 'nickname', width: 120 },
  { label: '所属部门', prop: 'dept', width: 150 },
  { label: '数据权限', prop: 'dataScope', width: 120, formatter: (r) => (r.dataScope === 'ALL' ? '全部仓库' : '所属仓库') },
  { label: '可见仓库', prop: 'warehouseIds', width: 160, formatter: (r) => (r.dataScope === 'ALL' ? '全部' : `${r.warehouseIds?.length ?? 0} 个`) },
  { label: '状态', prop: 'status', width: 90, align: 'center', formatter: (r) => (r.status === 1 ? '启用' : '停用') }
]

const fields: FormField[] = [
  { label: '账号', prop: 'username', type: 'input', required: true },
  { label: '姓名', prop: 'nickname', type: 'input', required: true },
  { label: '所属部门', prop: 'dept', type: 'input' },
  { label: '数据权限', prop: 'dataScope', type: 'input', placeholder: 'ALL 或 WAREHOUSE' }
]

/**
 * 用户维护涉及账号体系与密码策略，属于「明确不做」范围（见 README 第九节），
 * 这里保留页面演示列表与权限分配入口，写操作给出明确提示而不是静默失败。
 */
function notSupported(): Promise<null> {
  ElMessage.info('演示环境未开放用户写操作，可在真实后端接入后启用')
  return Promise.resolve(null)
}
</script>

<template>
  <CrudPage
    name="user"
    :api="{ list: getUserList, save: notSupported, remove: notSupported }"
    :columns="columns"
    :fields="fields"
    :search-props="['username', 'nickname']"
  />
</template>
