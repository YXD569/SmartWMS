<script setup lang="ts">
import { warehouseApi } from '@/api/base'
import CrudPage, { type FormField } from '@/components/CrudPage.vue'
import type { ProColumn } from '@/components/ProTable.vue'

defineOptions({ name: 'Warehouse' })

const columns: ProColumn[] = [
  { label: '仓库编码', prop: 'code', width: 120 },
  { label: '仓库名称', prop: 'name', minWidth: 160 },
  { label: '仓库类型', prop: 'type', width: 110, dict: 'warehouse_type' },
  { label: '所在省份', prop: 'province', width: 110 },
  { label: '面积(㎡)', prop: 'area', width: 110, align: 'right' },
  { label: '库位数', prop: 'locationCount', width: 100, align: 'right' },
  { label: '负责人', prop: 'manager', width: 100 },
  { label: '状态', prop: 'status', width: 90, align: 'center', formatter: (r) => (r.status === 1 ? '启用' : '停用') }
]

const fields: FormField[] = [
  { label: '仓库编码', prop: 'code', type: 'input', required: true },
  { label: '仓库名称', prop: 'name', type: 'input', required: true },
  { label: '仓库类型', prop: 'type', type: 'select', dict: 'warehouse_type', required: true },
  { label: '所在省份', prop: 'province', type: 'input' },
  { label: '面积(㎡)', prop: 'area', type: 'number' },
  { label: '库位数', prop: 'locationCount', type: 'number' },
  { label: '负责人', prop: 'manager', type: 'input' },
  { label: '状态', prop: 'status', type: 'number', default: 1 }
]
</script>

<template>
  <CrudPage
    name="warehouse"
    :api="{ list: warehouseApi.list, save: warehouseApi.save, remove: warehouseApi.remove }"
    :columns="columns"
    :fields="fields"
    :search-props="['name', 'type']"
  />
</template>
