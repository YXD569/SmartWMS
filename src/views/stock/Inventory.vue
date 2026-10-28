<script setup lang="ts">
/**
 * 库存台账
 * ------------------------------------------------------------------
 * 性能考点页：全量模式一次拉取 10 万行，用自研 VirtualTable 渲染，
 * DOM 节点恒定为可视区行数（约 20+缓冲），滚动帧率不受数据量影响。
 * 页面同时给出分页模式做对比，直观体现两种方案的渲染成本差异。
 */
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { stockApi } from '@/api/biz'
import { warehouseApi } from '@/api/base'
import ProTable, { type ProColumn } from '@/components/ProTable.vue'
import VirtualTable, { type VColumn } from '@/components/VirtualTable.vue'
import { number, date } from '@/utils/format'
import { dictLabel } from '@/utils/dict'
import type { Inventory } from '@/api/types'

defineOptions({ name: 'Inventory' })

/** 两种浏览模式：paged=分页（常规），virtual=全量虚拟滚动 */
const mode = ref<'paged' | 'virtual'>('virtual')
const loading = ref(false)
const loadTip = ref('')

const rows = ref<Inventory[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const warehouses = ref<any[]>([])

const filter = ref({ keyword: '', warehouseId: undefined as unknown as number, onlyWarn: false })

// ---------------- 分页模式 ----------------
async function loadPage() {
  loading.value = true
  try {
    const res = await stockApi.list({
      page: page.value,
      pageSize: pageSize.value,
      keyword: filter.value.keyword,
      warehouseId: filter.value.warehouseId,
      onlyWarn: filter.value.onlyWarn ? 1 : 0
    })
    rows.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

// ---------------- 全量 + 虚拟滚动 ----------------
const SIZE = 100000
async function loadAll() {
  loading.value = true
  loadTip.value = `正在生成并传输 ${SIZE.toLocaleString('zh-CN')} 行库存数据…`
  const t0 = performance.now()
  try {
    rows.value = await stockApi.all(SIZE)
    loadTip.value = `已加载 ${rows.value.length.toLocaleString('zh-CN')} 行，耗时 ${Math.round(performance.now() - t0)} ms`
  } catch (e: any) {
    ElMessage.error('加载失败：' + (e.message || '请确认 mock 服务已启动'))
  } finally {
    loading.value = false
  }
}

/** 全量模式下在前端过滤（数据量虽大，但过滤是 O(n) 单次操作，远快于逐行渲染） */
const filteredRows = computed(() => {
  const kw = filter.value.keyword.trim().toLowerCase()
  return rows.value.filter((r) => {
    if (filter.value.onlyWarn && !r.warning) return false
    if (filter.value.warehouseId && r.warehouseId !== filter.value.warehouseId) return false
    if (kw && !(`${r.goodsName}${r.goodsCode}${r.locationCode}`.toLowerCase().includes(kw))) return false
    return true
  })
})

const columns: ProColumn[] = [
  { label: '商品编码', prop: 'goodsCode', width: 120 },
  { label: '商品名称', prop: 'goodsName', minWidth: 160 },
  { label: '类别', prop: 'category', width: 100, dict: 'goods_category' },
  { label: '规格', prop: 'spec', width: 110 },
  { label: '仓库', prop: 'warehouseName', width: 120 },
  { label: '库位', prop: 'locationCode', width: 110 },
  { label: '库存量', prop: 'qty', width: 100, align: 'right', formatter: (r) => number(r.qty) },
  { label: '锁定量', prop: 'lockQty', width: 90, align: 'right' },
  { label: '安全库存', prop: 'safetyStock', width: 100, align: 'right' },
  { label: '批次号', prop: 'batchNo', width: 130 },
  { label: '生产日期', prop: 'produceDate', width: 110, formatter: (r) => date(r.produceDate) },
  { label: '到期日期', prop: 'expireDate', width: 110, formatter: (r) => date(r.expireDate) }
]

const vColumns: VColumn[] = [
  { label: '商品编码', prop: 'goodsCode', width: 120 },
  { label: '商品名称', prop: 'goodsName', width: '1.4' },
  { label: '类别', prop: 'category', width: 90, formatter: (r) => dictLabel('goods_category', r.category) },
  { label: '仓库', prop: 'warehouseName', width: 120 },
  { label: '库位', prop: 'locationCode', width: 110 },
  { label: '库存量', prop: 'qty', width: 100, align: 'right', formatter: (r) => number(r.qty) },
  { label: '安全库存', prop: 'safetyStock', width: 100, align: 'right' },
  { label: '批次', prop: 'batchNo', width: 120 },
  { label: '到期日', prop: 'expireDate', width: 110, formatter: (r) => date(r.expireDate) },
  { label: '状态', prop: 'warning', width: 90, align: 'center', slot: true }
]

function refresh() {
  if (mode.value === 'virtual') loadAll()
  else loadPage()
}

/**
 * 筛选条件变化：全量模式下数据已在本地，过滤是纯前端计算，
 * 只有分页模式才需要重新请求。旧实现无脑调 refresh()，
 * 导致虚拟滚动模式每敲一个字都重新传输约 6MB 数据
 */
function onFilterChange() {
  if (mode.value === 'virtual') return
  loadPage()
}

onMounted(async () => {
  warehouses.value = await warehouseApi.all()
  refresh()
})
</script>

<template>
  <div class="app-container">
    <el-card class="search-card" shadow="never">
      <el-form :model="filter" inline @submit.prevent>
        <el-form-item label="关键词">
          <el-input v-model="filter.keyword" placeholder="商品名称 / 编码 / 库位" clearable style="width: 180px" @change="onFilterChange" />
        </el-form-item>
        <el-form-item label="仓库">
          <el-select v-model="filter.warehouseId" placeholder="全部仓库" clearable style="width: 160px" @change="onFilterChange">
            <el-option v-for="w in warehouses" :key="w.id" :label="w.name" :value="w.id" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="filter.onlyWarn" @change="onFilterChange">仅看低于安全库存</el-checkbox>
        </el-form-item>
        <el-form-item>
          <el-radio-group v-model="mode" @change="refresh">
            <el-radio-button value="virtual">全量虚拟滚动</el-radio-button>
            <el-radio-button value="paged">普通分页</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Refresh" @click="refresh">刷新</el-button>
        </el-form-item>
      </el-form>
      <div v-if="loadTip" class="load-tip">{{ loadTip }}</div>
    </el-card>

    <el-card class="table-card" shadow="never">
      <!-- 虚拟滚动模式 -->
      <VirtualTable v-if="mode === 'virtual'" v-loading="loading" :columns="vColumns" :rows="filteredRows" :height="560">
        <template #warning="{ row }">
          <el-tag v-if="row.warning" type="danger" size="small">预警</el-tag>
          <el-tag v-else type="success" size="small">正常</el-tag>
        </template>
      </VirtualTable>

      <!-- 分页模式 -->
      <template v-else>
        <ProTable :columns="columns" :data="rows" :loading="loading" name="inventory" @refresh="refresh">
          <template #pagination>
            <el-pagination
              v-model:current-page="page"
              v-model:page-size="pageSize"
              :total="total"
              :page-sizes="[20, 50, 100]"
              layout="total, sizes, prev, pager, next, jumper"
              background
              @current-change="loadPage"
              @size-change="loadPage"
            />
          </template>
        </ProTable>
      </template>
    </el-card>
  </div>
</template>

<style scoped>
.load-tip {
  font-size: 12.5px;
  color: var(--sw-text-3);
  padding: 0 0 10px;
  font-variant-numeric: tabular-nums;
}
</style>
