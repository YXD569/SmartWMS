/**
 * 内存数据源
 * ------------------------------------------------------------------
 * 项目定位是前端工程演示，不引入数据库（见蓝图「明确不做」：不搞复杂后端架构）。
 * 数据用固定种子的伪随机生成，保证每次启动结果一致，便于截图与演示复现。
 */
const CATEGORIES = ['RAW', 'SEMI', 'FINISHED', 'PACKAGE', 'CONSUMABLE']
const CATEGORY_NAME = { RAW: '原材料', SEMI: '半成品', FINISHED: '成品', PACKAGE: '包装物', CONSUMABLE: '耗材' }
const UNITS = ['件', '箱', 'kg', 'm', '台']
const PROVINCES = ['广东', '江苏', '浙江', '山东', '四川', '湖北', '福建', '北京']
const WAREHOUSE_TYPES = ['CENTER', 'REGION', 'FRONT', 'TEMP']
const ZONES = ['A区', 'B区', 'C区', 'D区', 'E区']

/** 固定种子伪随机（mulberry32），保证数据可复现 */
function createRandom(seed) {
  let t = seed
  return function random() {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = createRandom(20261027)

function pick(arr) {
  return arr[Math.floor(rnd() * arr.length)]
}
function int(min, max) {
  return Math.floor(rnd() * (max - min + 1)) + min
}
function float(min, max, digits = 2) {
  return Number((rnd() * (max - min) + min).toFixed(digits))
}

/** 商品名称素材：拼装出像样的工业品名 */
const NAME_PREFIX = ['不锈钢', '铝合金', '碳钢', '铜制', '工程塑料', '橡胶', '陶瓷', '镀锌']
const NAME_CORE = ['螺帽', '螺栓', '法兰盘', '轴承', '型材', '板材', '管材', '垫片', '弹簧', '密封圈']
const SPEC_POOL = ['M8', 'M10', 'M12', 'Φ20', 'Φ32', '1.2m', '2.0m', '500ml', '10kg', ' standard']

function buildGoods() {
  const list = []
  for (let i = 1; i <= 200; i++) {
    const name = `${pick(NAME_PREFIX)}${pick(NAME_CORE)}`
    list.push({
      id: i,
      code: `G${String(i).padStart(5, '0')}`,
      name: `${name}-${i}`,
      category: pick(CATEGORIES),
      spec: pick(SPEC_POOL),
      unit: pick(UNITS),
      purchasePrice: float(2, 800),
      salePrice: float(3, 1200),
      safetyStock: int(50, 600),
      shelfLifeDays: int(30, 720),
      supplierId: int(1, 30),
      supplierName: '',
      status: rnd() > 0.08 ? 1 : 0,
      createTime: new Date(Date.now() - int(0, 300) * 86400000).toISOString()
    })
  }
  return list
}

function buildSuppliers() {
  const list = []
  for (let i = 1; i <= 30; i++) {
    list.push({
      id: i,
      code: `S${String(i).padStart(4, '0')}`,
      name: `${pick(PROVINCES)}${pick(['宏远', '鑫达', '恒信', '华中', '合力', '金鼎'])}${pick(['贸易', '制造', '实业', '供应'])}有限公司`,
      contact: pick(['张', '李', '王', '陈', '刘']) + pick(['明', '强', '磊', '芳', '静']),
      phone: `13${int(1, 9)}${String(int(0, 99999999)).padStart(8, '0')}`,
      address: `${pick(PROVINCES)}省${pick(['广州', '南京', '杭州', '青岛', '成都', '武汉'])}市${pick(['高新', '经济开发', '工业'])}区${int(1, 999)}号`,
      level: pick(['A', 'B', 'B', 'C']),
      status: 1,
      createTime: new Date(Date.now() - int(0, 400) * 86400000).toISOString()
    })
  }
  return list
}

function buildCustomers() {
  const list = []
  for (let i = 1; i <= 40; i++) {
    list.push({
      id: i,
      code: `C${String(i).padStart(4, '0')}`,
      name: `${pick(PROVINCES)}${pick(['华兴', '鼎盛', '天成', 'ocean', '瑞丰', '.mw']) }${pick(['商贸', '科技', '物流', '制造'])}有限公司`.replace(/ocean|\.mw/g, '汇通'),
      contact: pick(['赵', '孙', '周', '吴', '郑']) + pick(['涛', '婷', '鹏', '琳', '宇']),
      phone: `15${int(1, 9)}${String(int(0, 99999999)).padStart(8, '0')}`,
      address: `${pick(PROVINCES)}省${pick(['深圳', '苏州', '宁波', '济南', '重庆'])}市${int(1, 200)}号`,
      level: pick(['A', 'B', 'B', 'C']),
      status: 1,
      createTime: new Date(Date.now() - int(0, 350) * 86400000).toISOString()
    })
  }
  return list
}

function buildWarehouses() {
  const names = ['华南中心仓', '华东中心仓', '华北区域仓', '西南区域仓', '华中区域仓', '深圳前置仓', '杭州前置仓', '临时周转仓']
  return names.map((name, i) => ({
    id: i + 1,
    code: `W${String(i + 1).padStart(3, '0')}`,
    name,
    type: WAREHOUSE_TYPES[i % WAREHOUSE_TYPES.length],
    province: PROVINCES[i % PROVINCES.length],
    area: int(1200, 20000),
    locationCount: int(200, 3000),
    manager: pick(['张', '李', '王', '陈']) + pick(['明', '强', '磊', '芳']),
    status: 1,
    createTime: new Date(Date.now() - int(0, 500) * 86400000).toISOString()
  }))
}

const goods = buildGoods()
const suppliers = buildSuppliers()
const customers = buildCustomers()
const warehouses = buildWarehouses()

// 商品补齐供应商名称
goods.forEach((g) => {
  g.supplierName = suppliers.find((s) => s.id === g.supplierId)?.name || '-'
})

// ---------------- 单据 ----------------
let billSeq = 1000
function makeItems(bizType, count) {
  const items = []
  for (let i = 0; i < count; i++) {
    const g = pick(goods)
    const qty = int(10, 500)
    const price = bizType === 'SALE' ? g.salePrice : g.purchasePrice
    items.push({
      id: i + 1,
      goodsId: g.id,
      goodsCode: g.code,
      goodsName: g.name,
      spec: g.spec,
      unit: g.unit,
      qty,
      price,
      amount: Number((qty * price).toFixed(2)),
      bookQty: int(100, 800),
      realQty: int(80, 820),
      diffQty: 0
    })
  }
  items.forEach((i) => (i.diffQty = i.realQty - i.bookQty))
  if (bizType === 'CHECK') items.forEach((i) => (i.qty = i.diffQty))
  return items
}

const STATUS_POOL = ['DRAFT', 'PENDING', 'APPROVED', 'RUNNING', 'FINISHED', 'CANCELED']
function buildBills() {
  const list = []
  const conf = [
    { bizType: 'PURCHASE', n: 60, prefix: 'PO' },
    { bizType: 'SALE', n: 80, prefix: 'SO' },
    { bizType: 'CHECK', n: 24, prefix: 'CK' }
  ]
  conf.forEach(({ bizType, n, prefix }) => {
    for (let i = 0; i < n; i++) {
      const w = pick(warehouses)
      const partner = bizType === 'PURCHASE' ? pick(suppliers) : bizType === 'SALE' ? pick(customers) : null
      const items = makeItems(bizType, int(2, 6))
      list.push({
        id: ++billSeq,
        code: `${prefix}${String(20260000 + billSeq).slice(-8)}`,
        bizType,
        status: pick(STATUS_POOL),
        warehouseId: w.id,
        warehouseName: w.name,
        partnerId: partner?.id || 0,
        partnerName: partner?.name || '',
        totalQty: items.reduce((s, i) => s + (bizType === 'CHECK' ? Math.abs(i.qty) : i.qty), 0),
        totalAmount: Number(items.reduce((s, i) => s + i.amount, 0).toFixed(2)),
        remark: rnd() > 0.6 ? pick(['客户加急', '常规补货', '季度盘点', '供应商促销备货']) : '',
        creator: pick(['张明', '李强', '王磊', '陈芳']),
        createTime: new Date(Date.now() - int(0, 90) * 86400000).toISOString(),
        items
      })
    }
  })
  return list
}
const bills = buildBills()

// ---------------- 库存（10 万行）----------------
let inventoryCache = null
function buildInventory(size = 100000) {
  const list = new Array(size)
  for (let i = 0; i < size; i++) {
    const g = goods[i % goods.length]
    const w = warehouses[i % warehouses.length]
    const qty = int(0, 1500)
    const safety = g.safetyStock
    list[i] = {
      id: i + 1,
      goodsId: g.id,
      goodsCode: g.code,
      goodsName: g.name,
      spec: g.spec,
      category: g.category,
      unit: g.unit,
      warehouseId: w.id,
      warehouseName: w.name,
      locationCode: `${pick(ZONES)}-${String(int(1, 40)).padStart(2, '0')}-${String(int(1, 9))}`,
      qty,
      lockQty: int(0, 200),
      safetyStock: safety,
      batchNo: `B${String(int(100000, 999999))}`,
      produceDate: new Date(Date.now() - int(10, 300) * 86400000).toISOString().slice(0, 10),
      expireDate: new Date(Date.now() + int(-20, 400) * 86400000).toISOString().slice(0, 10),
      warning: qty < safety
    }
  }
  return list
}

function getInventory(size = 100000) {
  // 按 size 缓存：不同 size 分别缓存，避免小请求触发大数组重建
  if (!inventoryCache || inventoryCache.size !== size) {
    inventoryCache = { size, list: buildInventory(size) }
  }
  return inventoryCache.list
}

/** 全量接口只返回虚拟滚动需要的精简字段，10 万行传输体积可控 */
function toLightInventory(row) {
  return {
    id: row.id,
    goodsCode: row.goodsCode,
    goodsName: row.goodsName,
    category: row.category,
    warehouseId: row.warehouseId,
    warehouseName: row.warehouseName,
    locationCode: row.locationCode,
    qty: row.qty,
    safetyStock: row.safetyStock,
    batchNo: row.batchNo,
    expireDate: row.expireDate,
    warning: row.warning
  }
}

// ---------------- 流水 ----------------
const IO_TYPES = ['PURCHASE_IN', 'SALE_OUT', 'RETURN_IN', 'RETURN_OUT', 'PROFIT_IN', 'LOSS_OUT', 'TRANSFER']
let flowSeq = 0
function buildFlows(n = 200) {
  const list = []
  for (let i = 0; i < n; i++) {
    const g = pick(goods)
    const w = pick(warehouses)
    list.push({
      id: ++flowSeq,
      time: new Date(Date.now() - int(0, 7200) * 1000).toISOString(),
      ioType: pick(IO_TYPES),
      goodsName: g.name,
      warehouseId: w.id,
      warehouseName: w.name,
      qty: int(5, 400),
      billCode: `${pick(['PO', 'SO', 'CK'])}${String(int(20260000, 20269999))}`
    })
  }
  return list.sort((a, b) => (a.time < b.time ? 1 : -1))
}
const flows = buildFlows(200)

/** 生成一条新流水，供 WebSocket 实时推送 */
function makeFlow() {
  const g = pick(goods)
  const w = pick(warehouses)
  return {
    id: ++flowSeq,
    time: new Date().toISOString(),
    ioType: pick(IO_TYPES),
    goodsName: g.name,
    warehouseId: w.id,
    warehouseName: w.name,
    qty: int(5, 400),
    billCode: `${pick(['PO', 'SO'])}${String(int(20260000, 20269999))}`
  }
}

// ---------------- 预警 ----------------
function buildWarns() {
  const inv = getInventory(2000)
  return inv
    .filter((r) => r.warning)
    .slice(0, 60)
    .map((r, i) => {
      const gap = r.safetyStock - r.qty
      const expireInDays = Math.ceil((new Date(r.expireDate).getTime() - Date.now()) / 86400000)
      return {
        id: i + 1,
        goodsName: r.goodsName,
        goodsCode: r.goodsCode,
        // 带上 warehouseId，供服务端数据权限 scopeFilter 过滤
        warehouseId: r.warehouseId,
        warehouseName: r.warehouseName,
        qty: r.qty,
        safetyStock: r.safetyStock,
        gapQty: gap,
        level: gap > 300 ? 'HIGH' : gap > 120 ? 'MIDDLE' : 'LOW',
        expireInDays
      }
    })
    .sort((a, b) => b.gapQty - a.gapQty)
}

// ---------------- 大屏 ----------------
function buildScreen() {
  const inv = getInventory(10000)
  const trend = []
  const base = Date.now()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(base - i * 86400000)
    trend.push({
      date: d.toISOString().slice(0, 10),
      inQty: int(800, 3200),
      outQty: int(700, 3000)
    })
  }

  const categoryMap = new Map()
  inv.forEach((r) => {
    const name = CATEGORY_NAME[r.category] || r.category
    categoryMap.set(name, (categoryMap.get(name) || 0) + r.qty)
  })
  const category = Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value }))

  const heat = []
  warehouses.forEach((w) => {
    ZONES.forEach((z) => {
      heat.push({ warehouse: w.name, zone: z, value: int(20, 100) })
    })
  })

  const supplierRank = suppliers
    .slice(0, 10)
    .map((s) => ({ name: s.name.slice(0, 12), value: int(2000, 20000) }))
    .sort((a, b) => b.value - a.value)

  const customerRank = customers
    .slice(0, 8)
    .map((c) => ({ name: c.name.slice(0, 10), value: int(1500, 18000) }))
    .sort((a, b) => b.value - a.value)

  const kpi = [
    { key: 'outbound', label: '今日出库量', value: int(3200, 6800), unit: '件', mom: float(-0.12, 0.25, 4), icon: 'Box' },
    { key: 'turnover', label: '库存周转率', value: float(2.1, 5.4, 2), unit: '次/月', mom: float(-0.08, 0.15, 4), icon: 'TrendCharts' },
    { key: 'warn', label: '缺货 SKU', value: int(12, 68), unit: '个', mom: float(-0.2, 0.35, 4), icon: 'Warning' },
    { key: 'fulfill', label: '订单履约率', value: int(88, 99), unit: '%', mom: float(-0.05, 0.08, 4), icon: 'CircleCheck' }
  ]

  return {
    kpi,
    trend,
    category,
    supplierRank,
    customerRank,
    heat,
    warn: buildWarns().slice(0, 12),
    flow: flows.slice(0, 12),
    updateTime: new Date().toISOString()
  }
}

export {
  goods,
  suppliers,
  customers,
  warehouses,
  bills,
  flows,
  makeFlow,
  getInventory,
  toLightInventory,
  buildWarns,
  buildScreen,
  CATEGORY_NAME,
  int,
  float,
  pick
}
