<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { screenApi } from '@/api/screen'
import { stockApi } from '@/api/biz'
import { useUserStore } from '@/stores/user'
import { useEcharts, MINI_CHART_BASE } from '@/composables/useEcharts'
import { money, number, percent } from '@/utils/format'
import type { ScreenData, FlowItem } from '@/api/types'

defineOptions({ name: 'Dashboard' })

const router = useRouter()
const userStore = useUserStore()

const data = ref<ScreenData | null>(null)
const flows = ref<FlowItem[]>([])
const loading = ref(false)

const trendRef = ref<HTMLElement | null>(null)
const categoryRef = ref<HTMLElement | null>(null)

const trendOption = computed(() => ({
  ...MINI_CHART_BASE,
  xAxis: { type: 'category' as const, data: (data.value?.trend || []).map((t) => t.date.slice(5)), boundaryGap: false },
  yAxis: { type: 'value' as const },
  series: [
    { name: '入库', type: 'line' as const, smooth: true, data: (data.value?.trend || []).map((t) => t.inQty), areaStyle: { opacity: 0.12 }, itemStyle: { color: '#67c23a' } },
    { name: '出库', type: 'line' as const, smooth: true, data: (data.value?.trend || []).map((t) => t.outQty), areaStyle: { opacity: 0.12 }, itemStyle: { color: '#e6a23c' } }
  ],
  legend: { data: ['入库', '出库'], bottom: 0 }
}))

const categoryOption = computed(() => ({
  tooltip: { trigger: 'item' as const },
  series: [
    {
      type: 'pie' as const,
      radius: ['42%', '68%'],
      data: data.value?.category || [],
      label: { fontSize: 12 },
      itemStyle: { borderColor: '#fff', borderWidth: 2 }
    }
  ],
  legend: { bottom: 0, itemWidth: 10, itemHeight: 8 }
}))

const { setOption: setTrend } = useEcharts(trendRef, () => trendOption.value)
const { setOption: setCategory } = useEcharts(categoryRef, () => categoryOption.value)

async function load() {
  loading.value = true
  try {
    data.value = await screenApi.overview()
    flows.value = await stockApi.flow(8)
    // 数据到位后刷新图表
    setTimeout(() => {
      setTrend(trendOption.value, true)
      setCategory(categoryOption.value, true)
    }, 0)
  } finally {
    loading.value = false
  }
}

onMounted(load)

const quicks = [
  { title: '新增采购订单', icon: 'ShoppingCart', path: '/biz/purchase' },
  { title: '新增销售订单', icon: 'Sell', path: '/biz/sale' },
  { title: '库存台账', icon: 'Box', path: '/stock/inventory' },
  { title: '新建盘点单', icon: 'Finished', path: '/biz/check' },
  { title: '库存预警', icon: 'Warning', path: '/stock/warn' },
  { title: '决策大屏', icon: 'DataAnalysis', path: '/bigscreen' }
]
</script>

<template>
  <div v-loading="loading" class="app-container">
    <!-- 欢迎条 -->
    <div class="welcome">
      <div>
        <h3>{{ userStore.nickname }}，欢迎回来</h3>
        <p class="muted">今天是 {{ data?.updateTime?.slice(0, 10) || '-' }} · 当前角色：{{ userStore.roles.join('、') || '-' }}</p>
      </div>
      <el-button type="primary" icon="DataAnalysis" @click="router.push('/bigscreen')">打开决策大屏</el-button>
    </div>

    <!-- KPI -->
    <div class="stat-grid">
      <div v-for="k in data?.kpi || []" :key="k.key" class="stat-card">
        <div class="stat-icon" :style="{ background: k.key === 'warn' ? '#e6a23c' : '#409eff' }">
          <el-icon><component :is="k.icon" /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-label">{{ k.label }}</div>
          <div class="stat-value num">
            {{ k.value >= 10000 ? number(k.value) : k.value }}<span class="unit">{{ k.unit }}</span>
          </div>
          <div class="stat-trend">
            环比
            <span :class="k.mom >= 0 ? 'up' : 'down'">{{ k.mom >= 0 ? '+' : '' }}{{ percent(k.mom) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 图表 -->
    <div class="chart-grid">
      <div class="mini-screen">
        <div class="mini-title">
          <span>近 30 天出入库趋势</span>
          <el-button link type="primary" @click="router.push('/bigscreen')">查看更多</el-button>
        </div>
        <div ref="trendRef" style="height: 260px"></div>
      </div>
      <div class="mini-screen">
        <div class="mini-title"><span>库存品类结构</span></div>
        <div ref="categoryRef" style="height: 260px"></div>
      </div>
    </div>

    <!-- 快捷入口 + 实时流水 -->
    <div class="bottom-grid">
      <div class="mini-screen">
        <div class="mini-title"><span>快捷操作</span></div>
        <div class="quick-grid">
          <div v-for="q in quicks" :key="q.path" class="quick" @click="router.push(q.path)">
            <el-icon><component :is="q.icon" /></el-icon>
            <span>{{ q.title }}</span>
          </div>
        </div>
      </div>

      <div class="mini-screen">
        <div class="mini-title">
          <span>最新出入库流水</span>
          <el-button link type="primary" @click="router.push('/stock/flow')">全部</el-button>
        </div>
        <div class="flow">
          <div v-for="f in flows" :key="f.id" class="flow-row">
            <span class="t num">{{ f.time.slice(11, 19) }}</span>
            <span class="n">{{ f.goodsName }}</span>
            <span class="w muted">{{ f.warehouseName }}</span>
            <span class="q num" :class="f.ioType.includes('IN') ? 'in' : 'out'">
              {{ f.ioType.includes('IN') ? '+' : '-' }}{{ f.qty }}
            </span>
          </div>
          <div v-if="!flows.length" class="sw-empty">暂无数据</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.welcome {
  background: #fff;
  border-radius: var(--sw-radius);
  box-shadow: var(--sw-shadow-1);
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
html.dark .welcome { background: #1d1e1f; }
.welcome h3 { margin: 0 0 4px; font-size: 16px; font-weight: 600; }
.welcome p { margin: 0; font-size: 13px; }
.muted { color: var(--sw-text-3); }

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 14px;
}
.stat-card .unit { font-size: 12px; color: var(--sw-text-3); margin-left: 3px; font-weight: 400; }
.stat-trend .up { color: var(--sw-danger); }
.stat-trend .down { color: var(--sw-success); }

.chart-grid {
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  gap: 14px;
  margin-bottom: 14px;
}
.bottom-grid { display: grid; grid-template-columns: 1fr 1.2fr; gap: 14px; }

.quick-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.quick {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--sw-border-3);
  border-radius: var(--sw-radius);
  cursor: pointer;
  font-size: 13px;
  transition: all var(--sw-dur-fast) var(--sw-ease-out);
}
.quick:hover { border-color: var(--sw-primary); color: var(--sw-primary); background: var(--sw-primary-light); }
.quick .el-icon { font-size: 17px; }

.flow { max-height: 240px; overflow: auto; }
.flow-row {
  display: grid;
  grid-template-columns: 62px 1fr 86px 62px;
  gap: 8px;
  align-items: center;
  padding: 8px 2px;
  font-size: 13px;
  border-bottom: 1px dashed var(--sw-border-3);
}
.flow-row .n { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.flow-row .w { font-size: 12px; }
.flow-row .q { text-align: right; font-weight: 600; }
.flow-row .q.in { color: var(--sw-success); }
.flow-row .q.out { color: var(--sw-warning); }

@media (max-width: 1200px) {
  .stat-grid { grid-template-columns: repeat(2, 1fr); }
  .chart-grid, .bottom-grid { grid-template-columns: 1fr; }
}
</style>
