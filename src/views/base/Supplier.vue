<script setup lang="ts">
import { supplierApi } from '@/api/base'
import CrudPage, { type FormField } from '@/components/CrudPage.vue'
import type { ProColumn } from '@/components/ProTable.vue'

defineOptions({ name: 'Supplier' })

const columns: ProColumn[] = [
  { label: '供应商编码', prop: 'code', width: 120 },
  { label: '供应商名称', prop: 'name', minWidth: 180 },
  { label: '联系人', prop: 'contact', width: 100 },
  { label: '联系电话', prop: 'phone', width: 130 },
  { label: '合作等级', prop: 'level', width: 100, formatter: (r) => ({ A: '战略', B: '优选', C: '普通' }[r.level] || r.level) },
  { label: '地址', prop: 'address', minWidth: 200 },
  { label: '状态', prop: 'status', width: 90, align: 'center', formatter: (r) => (r.status === 1 ? '启用' : '停用') }
]

const fields: FormField[] = [
  { label: '供应商编码', prop: 'code', type: 'input', required: true },
  { label: '供应商名称', prop: 'name', type: 'input', required: true },
  { label: '联系人', prop: 'contact', type: 'input' },
  { label: '联系电话', prop: 'phone', type: 'input', required: true },
  { label: '合作等级', prop: 'level', type: 'input', placeholder: 'A / B / C' },
  { label: '地址', prop: 'address', type: 'textarea', span: 24 },
  { label: '状态', prop: 'status', type: 'number', default: 1 }
]
</script>

<template>
  <CrudPage
    name="supplier"
    :api="{ list: supplierApi.list, save: supplierApi.save, remove: supplierApi.remove }"
    :columns="columns"
    :fields="fields"
    :search-props="['name', 'contact']"
  />
</template>
