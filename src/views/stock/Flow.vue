<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { stockApi } from '@/api/biz'
import ProTable, { type ProColumn } from '@/components/ProTable.vue'
import DictTag from '@/components/DictTag.vue'
import { number, datetime } from '@/utils/format'
import type { FlowItem } from '@/api/types'

defineOptions({ name: 'StockFlow' })

const rows = ref<FlowItem[]>([])
const loading = ref(false)
const limit = ref(200)

const columns: ProColumn[] = [
  { label: '时间', prop: 'time', width: 170, formatter: (r) => datetime(r.time) },
  { label: '单据编号', prop: 'billCode', width: 160 },
  { label: '类型', prop: 'ioType', width: 120, dict: 'io_type', dictDot: true },
  { label: '商品', prop: 'goodsName', minWidth: 180 },
  { label: '仓库', prop: 'warehouseName', width: 140 },
  { label: '数量', prop: 'qty', width: 110, align: 'right', slot: true }
]

async function load() {
  loading.value = true
  try {
    rows.value = await stockApi.flow(limit.value)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="app-container">
    <el-card class="search-card" shadow="never">
      <el-form inline @submit.prevent>
        <el-form-item label="显示条数">
          <el-select v-model="limit" style="width: 140px" @change="load">
            <el-option :value="100" label="最近 100 条" />
            <el-option :value="200" label="最近 200 条" />
            <el-option :value="500" label="最近 500 条" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Refresh" @click="load">刷新</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="table-card" shadow="never">
      <ProTable :columns="columns" :data="rows" :loading="loading" name="stock-flow" height="560" @refresh="load">
        <template #qty="{ row }">
          <span class="num" :class="row.ioType.includes('IN') ? 'in' : 'out'">
            {{ row.ioType.includes('IN') ? '+' : '-' }}{{ number(row.qty) }}
          </span>
        </template>
      </ProTable>
    </el-card>
  </div>
</template>

<style scoped>
.num { font-variant-numeric: tabular-nums; font-weight: 600; }
.in { color: var(--sw-success); }
.out { color: var(--sw-warning); }
</style>
