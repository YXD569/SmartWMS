<script setup lang="ts">
import { goodsApi } from '@/api/base'
import CrudPage, { type FormField } from '@/components/CrudPage.vue'
import type { ProColumn } from '@/components/ProTable.vue'
import { money } from '@/utils/format'

defineOptions({ name: 'Goods' })

const columns: ProColumn[] = [
  { label: '商品编码', prop: 'code', width: 120 },
  { label: '商品名称', prop: 'name', minWidth: 160 },
  { label: '类别', prop: 'category', width: 100, dict: 'goods_category' },
  { label: '规格', prop: 'spec', width: 110 },
  { label: '单位', prop: 'unit', width: 70, align: 'center' },
  { label: '采购价', prop: 'purchasePrice', width: 100, align: 'right', formatter: (r) => money(r.purchasePrice) },
  { label: '销售价', prop: 'salePrice', width: 100, align: 'right', formatter: (r) => money(r.salePrice) },
  { label: '安全库存', prop: 'safetyStock', width: 100, align: 'right' },
  { label: '保质期(天)', prop: 'shelfLifeDays', width: 110, align: 'right' },
  { label: '供应商', prop: 'supplierName', width: 140 },
  { label: '状态', prop: 'status', width: 90, align: 'center', formatter: (r) => (r.status === 1 ? '启用' : '停用') }
]

const fields: FormField[] = [
  { label: '商品编码', prop: 'code', type: 'input', required: true },
  { label: '商品名称', prop: 'name', type: 'input', required: true },
  { label: '类别', prop: 'category', type: 'select', dict: 'goods_category', required: true },
  { label: '规格型号', prop: 'spec', type: 'input' },
  { label: '计量单位', prop: 'unit', type: 'select', dict: 'unit', required: true },
  { label: '采购价', prop: 'purchasePrice', type: 'number', required: true },
  { label: '销售价', prop: 'salePrice', type: 'number', required: true },
  { label: '安全库存', prop: 'safetyStock', type: 'number' },
  { label: '保质期(天)', prop: 'shelfLifeDays', type: 'number' },
  { label: '供应商', prop: 'supplierName', type: 'input' }
]
</script>

<template>
  <CrudPage
    name="goods"
    :api="{ list: goodsApi.list, save: goodsApi.save, remove: goodsApi.remove }"
    :columns="columns"
    :fields="fields"
    :search-props="['name', 'category', 'code']"
  />
</template>
