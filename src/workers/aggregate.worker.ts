/**
 * 聚合 Worker
 * ------------------------------------------------------------------
 * 大屏需要对大批量出入库流水做「按小时 / 按仓库」聚合。这类纯计算任务放在主线程
 * 会阻塞渲染导致掉帧，放到 Worker 后主线程只负责收结果与画图。
 *
 * 用法见 views/screen/index.vue
 */
// 不能用 Record 命名：会与 TS 内置工具类型 Record 冲突
interface FlowRecord {
  /** 小时 0-23 */
  h: number
  /** 方向：1 入库，2 出库 */
  dir: number
  qty: number
  warehouse: string
}

self.onmessage = (e: MessageEvent<{ records: FlowRecord[] }>) => {
  const t0 = performance.now()
  const { records } = e.data

  const inByHour = new Array(24).fill(0)
  const outByHour = new Array(24).fill(0)
  const byWarehouse = new Map<string, number>()

  for (let i = 0; i < records.length; i++) {
    const r = records[i]
    if (r.dir === 1) inByHour[r.h] += r.qty
    else outByHour[r.h] += r.qty
    byWarehouse.set(r.warehouse, (byWarehouse.get(r.warehouse) || 0) + r.qty)
  }

  const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)
  const warehouseRank = Array.from(byWarehouse.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  self.postMessage({
    hours,
    inQty: inByHour,
    outQty: outByHour,
    warehouseRank,
    cost: Math.round(performance.now() - t0),
    count: records.length
  })
}
