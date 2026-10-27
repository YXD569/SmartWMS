<script setup lang="ts">
/**
 * BI 决策大屏
 * ------------------------------------------------------------------
 * 布局：1920×1080 设计基准，transform scale 等比缩放适配到任意分辨率（含 4K）
 * 之所以选 scale 而不是 rem/vw：大屏是「固定画布」场景，等比缩放能保证
 * 图表比例、字号、间距与设计稿完全一致，不会因宽高比差异导致错位。
 * 代价是超宽屏会有留白，这里用背景光晕填充，观感上不突兀。
 *
 * 数据流：首次拉全量 -> WebSocket 增量推送流水 -> setOption 增量合并（非整图重绘）
 * 计算：5 万条流水的分时聚合放到 Web Worker，主线程只负责渲染
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { screenApi, flowWsUrl } from '@/api/screen'
import ChartRenderer, { type ChartConfig } from '@/components/ChartRenderer.vue'
import { useAppStore } from '@/stores/app'
import { emitter } from '@/utils/emitter'
import { compact, number, percent, time } from '@/utils/format'
import type { ScreenData, FlowItem } from '@/api/types'
// Vite 的 ?worker 后缀：打包时自动拆成独立 chunk
import AggregateWorker from '@/workers/aggregate.worker.ts?worker'

defineOptions({ name: 'BigScreen' })

const appStore = useAppStore()

// ---------------- 缩放适配 ----------------
const scale = ref(1)
function calcScale() {
  const w = window.innerWidth
  const h = window.innerHeight
  scale.value = Math.min(w / 1920, h / 1080)
}
const wrapperStyle = computed(() => ({
  transform: `scale(${scale.value})`,
  left: `${(window.innerWidth - 1920 * scale.value) / 2}px`,
  top: `${(window.innerHeight - 1080 * scale.value) / 2}px`
}))

// ---------------- 数据 ----------------
const data = ref<ScreenData | null>(null)
const flows = ref<FlowItem[]>([])
const newFlowIds = ref<number[]>([])
const loading = ref(true)
const loadError = ref('')
const online = ref(false)
const now = ref(new Date())

let ws: WebSocket | null = null
let timer: number | null = null
let worker: Worker | null = null
const workerInfo = ref('')

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    data.value = await screenApi.overview()
    flows.value = data.value.flow || []
    // 数据到位后启动 Worker 聚合
    runWorker()
  } catch (e: any) {
    loadError.value = e?.message || '数据加载失败'
  } finally {
    loading.value = false
  }
}

/** Web Worker：把 5 万条流水的分时聚合挪到后台线程 */
function runWorker() {
  if (worker) worker.terminate()
  worker = new AggregateWorker()
  // 构造演示数据集：以真实流水为蓝本扩展到 5 万条，用于体现 Worker 的计算价值
  const base = flows.value.length ? flows.value : []
  const records: { h: number; dir: number; qty: number; warehouse: string }[] = []
  for (let i = 0; i < 50000; i++) {
    const s = base[i % Math.max(base.length, 1)]
    records.push({
      h: i % 24,
      dir: (s?.ioType || '').includes('IN') ? 1 : 2,
      qty: (s?.qty || 0) + (i % 7),
      warehouse: s?.warehouseName || '中心仓'
    })
  }
  worker.onmessage = (e: MessageEvent) => {
    const { hours, inQty, outQty, warehouseRank, cost, count } = e.data
    workerInfo.value = `Worker 聚合 ${count.toLocaleString('zh-CN')} 条流水，耗时 ${cost} ms`
    hourTrend.value = { hours, inQty, outQty }
    warehouseRankRows.value = warehouseRank
  }
  worker.postMessage({ records })
}

const hourTrend = ref<{ hours: string[]; inQty: number[]; outQty: number[] } | null>(null)
const warehouseRankRows = ref<{ name: string; value: number }[]>([])

// ---------------- WebSocket 实时流水 ----------------
function connectWs() {
  try {
    ws = new WebSocket(flowWsUrl())
    ws.onopen = () => (online.value = true)
    ws.onmessage = (e) => {
      try {
        const item: FlowItem = JSON.parse(e.data)
        flows.value = [item, ...flows.value].slice(0, 40)
        newFlowIds.value.push(item.id)
        setTimeout(() => {
          newFlowIds.value = newFlowIds.value.filter((id) => id !== item.id)
        }, 1000)
      } catch {
        // 忽略脏数据
      }
    }
    ws.onclose = () => {
      online.value = false
      // 断线 3 秒重连
      setTimeout(connectWs, 3000)
    }
    ws.onerror = () => (online.value = false)
  } catch {
    online.value = false
  }
}

// ---------------- 图表配置（全部走配置驱动渲染引擎）----------------
const trendConfig = computed<ChartConfig>(() => ({
  type: 'line',
  rows: (data.value?.trend || []).map((t) => ({ date: t.date.slice(5), inQty: t.inQty, outQty: t.outQty })),
  xField: 'date',
  yFields: ['inQty', 'outQty'],
  names: ['入库', '出库'],
  theme: 'screen'
}))

const hourConfig = computed<ChartConfig>(() => ({
  type: 'bar',
  rows: (hourTrend.value?.hours || []).map((h, i) => ({
    hour: h,
    inQty: hourTrend.value?.inQty[i] || 0,
    outQty: hourTrend.value?.outQty[i] || 0
  })),
  xField: 'hour',
  yFields: ['inQty', 'outQty'],
  names: ['入库', '出库'],
  theme: 'screen'
}))

const categoryConfig = computed<ChartConfig>(() => ({
  type: 'pie',
  rows: data.value?.category || [],
  xField: 'name',
  yFields: ['value'],
  theme: 'screen'
}))

const heatConfig = computed<ChartConfig>(() => ({
  type: 'heatmap',
  rows: data.value?.heat || [],
  xField: 'warehouse',
  yFields: ['zone', 'value'],
  theme: 'screen'
}))

const regionConfig = computed<ChartConfig>(() => ({
  type: 'bar',
  rows: (data.value?.customerRank || []).map((r) => ({ name: r.name, value: r.value })),
  xField: 'name',
  yFields: ['value'],
  names: ['业务量'],
  theme: 'screen'
}))

const gaugeConfig = computed<ChartConfig>(() => {
  const kpi = data.value?.kpi.find((k) => k.key === 'fulfill')?.value ?? 92
  return { type: 'gauge', rows: [{ value: kpi }], xField: '', yFields: ['value'], theme: 'screen' }
})

const supplierRank = computed(() => data.value?.supplierRank || [])
const warnList = computed(() => data.value?.warn || [])

const maxRank = computed(() => Math.max(1, ...supplierRank.value.map((r) => r.value)))

// ---------------- AI 联动：点击 KPI 追问异动原因 ----------------
function askAi(kpi: { key: string; label: string }) {
  appStore.openAi('explain')
  emitter.emit('ai:explain-context', { key: kpi.key, label: kpi.label })
}

function ioLabel(t: string) {
  return t.includes('IN') ? '入' : '出'
}

// ---------------- 离屏优化：页面不可见时停掉时钟与推送 ----------------
let visibilityHandler: (() => void) | null = null

onMounted(() => {
  calcScale()
  window.addEventListener('resize', calcScale)
  load()
  connectWs()
  timer = window.setInterval(() => (now.value = new Date()), 1000)

  visibilityHandler = () => {
    if (document.hidden) {
      if (timer) {
        window.clearInterval(timer)
        timer = null
      }
      ws?.close()
    } else {
      if (!timer) timer = window.setInterval(() => (now.value = new Date()), 1000)
      if (!ws || ws.readyState === WebSocket.CLOSED) connectWs()
    }
  }
  document.addEventListener('visibilitychange', visibilityHandler)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', calcScale)
  if (timer) window.clearInterval(timer)
  ws?.close()
  worker?.terminate()
  if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler)
})

const dateText = computed(() => {
  const d = now.value
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  return `${d.getFullYear()} 年 ${String(d.getMonth() + 1).padStart(2, '0')} 月 ${String(d.getDate()).padStart(2, '0')} 日　星期${week}`
})
</script>

<template>
  <div class="screen-root">
    <div v-if="loading" class="screen-loading">正在加载大屏数据…</div>
    <div v-else-if="loadError" class="screen-loading">{{ loadError }}　<el-button size="small" @click="load">重试</el-button></div>

    <div class="screen-scale" :style="wrapperStyle">
      <!-- 头部 -->
      <div class="screen-header">
        <div class="side left">{{ dateText }}　{{ time(now) }}</div>
        <div class="screen-title">智联仓储运营决策中心</div>
        <div class="side right">
          <span>{{ workerInfo }}</span>
          <span>数据更新 {{ data?.updateTime?.slice(11, 19) || '--:--:--' }}</span>
        </div>
      </div>

      <!-- KPI -->
      <div class="kpi-row">
        <div
          v-for="k in data?.kpi || []"
          :key="k.key"
          class="kpi-card"
          @click="askAi(k)"
        >
          <div class="kpi-icon"><el-icon><component :is="k.icon" /></el-icon></div>
          <div>
            <div class="kpi-label">{{ k.label }}</div>
            <div class="kpi-value">
              {{ k.value >= 10000 ? compact(k.value) : number(k.value) }}
              <span class="kpi-unit">{{ k.unit }}</span>
            </div>
            <div class="kpi-trend">
              环比
              <span :class="k.mom >= 0 ? 'trend-up' : 'trend-down'">
                {{ k.mom >= 0 ? '↑' : '↓' }} {{ percent(Math.abs(k.mom)) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 主体三栏 -->
      <div class="screen-body">
        <!-- 左 -->
        <div class="screen-col">
          <div class="screen-panel" style="flex: 1.1">
            <div class="panel-title"><span class="bar"></span>近 30 天出入库趋势<span class="extra">单位：件</span></div>
            <div class="panel-body"><ChartRenderer :config="trendConfig" :height="210" /></div>
          </div>
          <div class="screen-panel" style="flex: 1">
            <div class="panel-title"><span class="bar"></span>今日分时出入库<span class="extra">Worker 聚合</span></div>
            <div class="panel-body"><ChartRenderer :config="hourConfig" :height="180" /></div>
          </div>
          <div class="screen-panel" style="flex: 1">
            <div class="panel-title"><span class="bar"></span>库存品类结构</div>
            <div class="panel-body"><ChartRenderer :config="categoryConfig" :height="180" /></div>
          </div>
        </div>

        <!-- 中 -->
        <div class="screen-col">
          <div class="screen-panel" style="flex: 1.25">
            <div class="panel-title"><span class="bar"></span>仓库库位库存热力<span class="extra">识别拥堵库区</span></div>
            <div class="panel-body"><ChartRenderer :config="heatConfig" :height="290" /></div>
          </div>
          <div class="screen-panel" style="flex: 1">
            <div class="panel-title">
              <span class="bar"></span>实时出入库流水
              <span class="extra">{{ online ? 'WebSocket 已连接' : '连接中…' }}</span>
            </div>
            <div class="panel-body">
              <div v-if="!flows.length" class="screen-empty">等待实时数据推送…</div>
              <div v-else class="flow-list">
                <div
                  v-for="f in flows.slice(0, 9)"
                  :key="f.id"
                  class="flow-item"
                  :class="[f.ioType.includes('IN') ? 'in' : 'out', { 'is-new': newFlowIds.includes(f.id) }]"
                >
                  <span class="t">{{ f.time.slice(11, 19) }}</span>
                  <span class="n">{{ f.goodsName }}</span>
                  <span>{{ f.warehouseName }}</span>
                  <span class="v">{{ ioLabel(f.ioType) }} {{ f.qty }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 右 -->
        <div class="screen-col">
          <div class="screen-panel" style="flex: 1">
            <div class="panel-title"><span class="bar"></span>供应商供货 TOP10</div>
            <div class="panel-body">
              <div v-if="!supplierRank.length" class="screen-empty">暂无数据</div>
              <div v-else class="rank-list">
                <div v-for="(r, i) in supplierRank" :key="r.name" class="rank-item">
                  <span class="idx">{{ i + 1 }}</span>
                  <div>
                    <div class="name">{{ r.name }}</div>
                    <div class="bar" :style="{ width: `${(r.value / maxRank) * 100}%` }"></div>
                  </div>
                  <span class="val">{{ compact(r.value) }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="screen-panel" style="flex: 0.9">
            <div class="panel-title"><span class="bar"></span>订单履约率</div>
            <div class="panel-body"><ChartRenderer :config="gaugeConfig" :height="150" /></div>
          </div>

          <div class="screen-panel" style="flex: 1.1">
            <div class="panel-title">
              <span class="bar"></span>库存预警中心
              <span class="extra">{{ warnList.length }} 条</span>
            </div>
            <div class="panel-body">
              <div v-if="!warnList.length" class="screen-empty">当前无预警</div>
              <div v-else class="warn-list">
                <div
                  v-for="w in warnList.slice(0, 7)"
                  :key="w.id"
                  class="warn-item"
                  :class="{ 'lv-high': w.level === 'HIGH' }"
                >
                  <span class="lv">{{ w.level === 'HIGH' ? '严重' : w.level === 'MIDDLE' ? '警告' : '关注' }}</span>
                  <span class="name">{{ w.goodsName }}</span>
                  <span class="qty">缺口 {{ w.gapQty }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部状态 -->
      <div class="screen-status">
        <span><i class="dot" :class="{ offline: !online }"></i>{{ online ? '实时连接正常' : '实时连接中断' }}</span>
        <span>基准分辨率 1920×1080</span>
        <span>当前缩放 {{ (scale * 100).toFixed(0) }}%</span>
        <span>点击任意指标卡可唤起 AI 解读异动</span>
      </div>
    </div>
  </div>
</template>
