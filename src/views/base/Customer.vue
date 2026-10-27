<script setup lang="ts">
import { customerApi } from '@/api/base'
import CrudPage, { type FormField } from '@/components/CrudPage.vue'
import type { ProColumn } from '@/components/ProTable.vue'

defineOptions({ name: 'Customer' })

const columns: ProColumn[] = [
  { label: '客户编码', prop: 'code', width: 120 },
  { label: '客户名称', prop: 'name', minWidth: 180 },
  { label: '联系人', prop: 'contact', width: 100 },
  { label: '联系电话', prop: 'phone', width: 130 },
  { label: '客户等级', prop: 'level', width: 100, formatter: (r) => ({ A: '重点', B: '常规', C: '潜力' }[r.level] || r.level) },
  { label: '收货地址', prop: 'address', minWidth: 200 },
  { label: '状态', prop: 'status', width: 90, align: 'center', formatter: (r) => (r.status === 1 ? '启用' : '停用') }
]

const fields: FormField[] = [
  { label: '客户编码', prop: 'code', type: 'input', required: true },
  { label: '客户名称', prop: 'name', type: 'input', required: true },
  { label: '联系人', prop: 'contact', type: 'input' },
  { label: '联系电话', prop: 'phone', type: 'input', required: true },
  { label: '客户等级', prop: 'level', type: 'input', placeholder: 'A / B / C' },
  { label: '收货地址', prop: 'address', type: 'textarea', span: 24 },
  { label: '状态', prop: 'status', type: 'number', default: 1 }
]
</script>

<template>
  <CrudPage
    name="customer"
    :api="{ list: customerApi.list, save: customerApi.save, remove: customerApi.remove }"
    :columns="columns"
    :fields="fields"
    :search-props="['name', 'contact']"
  />
</template>
