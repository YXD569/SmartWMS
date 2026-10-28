/**
 * SmartWMS Mock 服务
 * ------------------------------------------------------------------
 * 定位：为前端演示提供「像真实后端一样」的接口契约，不引入数据库（见蓝图「明确不做」）。
 * 已实现的关键后端语义：
 *   1. 双 Token：accessToken 短效 + refreshToken 长效，刷新后旧 refresh 作废旧换新
 *   2. RBAC：按角色下发路由树与按钮权限，同一套菜单不同角色看到不同结果
 *   3. 数据权限：WAREHOUSE 作用域只能看到所属仓库的数据
 *   4. 单据状态机：状态流转规则在服务端兜底校验，前端校验可被绕过
 *   5. SSE：/ai/chat 以 text/event-stream 逐帧推送，支持客户端中断
 *   6. WebSocket：/screen/flow 增量推送实时流水
 * 启停：node server/index.js（默认 48081）
 */
import http from 'node:http'
import crypto from 'node:crypto'
import express from 'express'
import cors from 'cors'
import { WebSocketServer } from 'ws'
import {
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
  CATEGORY_NAME
} from './data.js'

const PORT = Number(process.env.MOCK_PORT || 48081)
/** accessToken 有效期，调小（如 5000）可直观观察双 Token 无感刷新 */
const ACCESS_TTL = Number(process.env.MOCK_ACCESS_TTL || 10 * 60 * 1000)
const REFRESH_TTL = Number(process.env.MOCK_REFRESH_TTL || 7 * 24 * 3600 * 1000)
const SECRET = 'smartwms-mock-secret'

// ============================================================
// 统一返回结构
// ============================================================
function ok(res, data) {
  res.json({ code: 200, data, msg: 'ok' })
}
function fail(res, msg, code = 500) {
  res.json({ code, data: null, msg })
}

// ============================================================
// Token：payload + 简易签名（演示用，非 JWT 标准实现）
// ============================================================
function sign(payloadStr) {
  return crypto.createHash('md5').update(payloadStr + SECRET).digest('hex').slice(0, 16)
}
function issueToken(payload, ttl) {
  const body = { ...payload, exp: Date.now() + ttl }
  const s = Buffer.from(JSON.stringify(body)).toString('base64url')
  return `${s}.${sign(s)}`
}
function parseToken(token) {
  if (!token || typeof token !== 'string') return null
  const [s, sig] = token.split('.')
  if (!s || !sig || sign(s) !== sig) return null
  try {
    const body = JSON.parse(Buffer.from(s, 'base64url').toString('utf8'))
    if (!body.exp || body.exp < Date.now()) return null
    return body
  } catch {
    return null
  }
}

// ============================================================
// 账号 / 角色 / 权限
// ============================================================
const ACCOUNTS = [
  {
    id: 1,
    username: 'admin',
    password: 'admin123',
    nickname: '系统管理员',
    dept: '集团信息中心',
    roles: ['admin'],
    dataScope: 'ALL',
    warehouseIds: []
  },
  {
    id: 2,
    username: 'stock',
    password: '123456',
    nickname: '仓储专员 · 陈芳',
    dept: '华南中心仓',
    roles: ['stock'],
    dataScope: 'WAREHOUSE',
    warehouseIds: [1, 6]
  }
]

/** refreshToken -> 用户名，模拟服务端会话表；刷新后旧 refresh 失效 */
const refreshStore = new Map()

const MENU_TREE = [
  {
    id: 10,
    parentId: 0,
    name: 'Base',
    path: '/base',
    component: null,
    title: '基础数据',
    icon: 'Files',
    sort: 1,
    permissions: [],
    children: [
      {
        id: 11,
        parentId: 10,
        name: 'Goods',
        path: '/base/goods',
        component: 'base/Goods.vue',
        title: '商品管理',
        icon: 'Goods',
        sort: 1,
        permissions: ['wms:goods:add', 'wms:goods:edit', 'wms:goods:delete', 'wms:goods:export', 'wms:goods:import']
      },
      {
        id: 12,
        parentId: 10,
        name: 'Supplier',
        path: '/base/supplier',
        component: 'base/Supplier.vue',
        title: '供应商管理',
        icon: 'Shop',
        sort: 2,
        permissions: ['wms:supplier:add', 'wms:supplier:edit', 'wms:supplier:delete', 'wms:supplier:export', 'wms:supplier:import']
      },
      {
        id: 13,
        parentId: 10,
        name: 'Customer',
        path: '/base/customer',
        component: 'base/Customer.vue',
        title: '客户管理',
        icon: 'User',
        sort: 3,
        permissions: ['wms:customer:add', 'wms:customer:edit', 'wms:customer:delete', 'wms:customer:export', 'wms:customer:import']
      },
      {
        id: 14,
        parentId: 10,
        name: 'Warehouse',
        path: '/base/warehouse',
        component: 'base/Warehouse.vue',
        title: '仓库管理',
        icon: 'OfficeBuilding',
        sort: 4,
        permissions: ['wms:warehouse:add', 'wms:warehouse:edit', 'wms:warehouse:delete', 'wms:warehouse:export', 'wms:warehouse:import']
      }
    ]
  },
  {
    id: 20,
    parentId: 0,
    name: 'Biz',
    path: '/biz',
    component: null,
    title: '业务单据',
    icon: 'Tickets',
    sort: 2,
    permissions: [],
    children: [
      {
        id: 21,
        parentId: 20,
        name: 'Purchase',
        path: '/biz/purchase',
        component: 'biz/Purchase.vue',
        title: '采购入库单',
        icon: 'ShoppingCart',
        sort: 1,
        permissions: ['wms:bill:add', 'wms:bill:edit', 'wms:bill:delete', 'wms:bill:audit']
      },
      {
        id: 22,
        parentId: 20,
        name: 'Sale',
        path: '/biz/sale',
        component: 'biz/Sale.vue',
        title: '销售出库单',
        icon: 'Sell',
        sort: 2,
        permissions: ['wms:bill:add', 'wms:bill:edit', 'wms:bill:delete', 'wms:bill:audit']
      },
      {
        id: 23,
        parentId: 20,
        name: 'Check',
        path: '/biz/check',
        component: 'biz/Check.vue',
        title: '库存盘点单',
        icon: 'Finished',
        sort: 3,
        permissions: ['wms:bill:add', 'wms:bill:edit', 'wms:bill:delete', 'wms:bill:audit']
      }
    ]
  },
  {
    id: 30,
    parentId: 0,
    name: 'Stock',
    path: '/stock',
    component: null,
    title: '库存管理',
    icon: 'Box',
    sort: 3,
    permissions: [],
    children: [
      {
        id: 31,
        parentId: 30,
        name: 'Inventory',
        path: '/stock/inventory',
        component: 'stock/Inventory.vue',
        title: '库存台账',
        icon: 'Grid',
        sort: 1,
        permissions: ['wms:inventory:export']
      },
      {
        id: 32,
        parentId: 30,
        name: 'StockWarn',
        path: '/stock/warn',
        component: 'stock/Warn.vue',
        title: '缺货预警',
        icon: 'WarningFilled',
        sort: 2,
        permissions: ['wms:warn:list']
      },
      {
        id: 33,
        parentId: 30,
        name: 'StockFlow',
        path: '/stock/flow',
        component: 'stock/Flow.vue',
        title: '出入库流水',
        icon: 'Sort',
        sort: 3,
        permissions: ['wms:flow:list']
      }
    ]
  },
  {
    id: 40,
    parentId: 0,
    name: 'System',
    path: '/system',
    component: null,
    title: '系统管理',
    icon: 'Setting',
    sort: 9,
    permissions: [],
    children: [
      {
        id: 41,
        parentId: 40,
        name: 'User',
        path: '/system/user',
        component: 'system/User.vue',
        title: '用户管理',
        icon: 'UserFilled',
        sort: 1,
        permissions: ['wms:user:add', 'wms:user:edit', 'wms:user:delete', 'wms:user:export', 'wms:user:import']
      },
      {
        id: 42,
        parentId: 40,
        name: 'Role',
        path: '/system/role',
        component: 'system/Role.vue',
        title: '角色权限',
        icon: 'Operation',
        sort: 2,
        permissions: ['wms:role:list', 'wms:role:edit']
      }
    ]
  }
]

/** 角色 -> 可见菜单 id；admin 全量，stock 无系统管理 */
const ROLE_MENUS = {
  admin: null, // null = 全量
  stock: [10, 11, 12, 13, 14, 20, 21, 22, 23, 30, 31, 32, 33]
}

/** 角色 -> 按钮权限；stock 去掉删除与系统类权限 */
const ROLE_PERMISSIONS = {
  admin: ['*:*'],
  // 仓储专员：有新增/编辑/审核/导入导出，无删除、无系统管理
  stock: [
    'wms:goods:add', 'wms:goods:edit', 'wms:goods:export', 'wms:goods:import',
    'wms:supplier:add', 'wms:supplier:edit', 'wms:supplier:export', 'wms:supplier:import',
    'wms:customer:add', 'wms:customer:edit', 'wms:customer:export', 'wms:customer:import',
    'wms:warehouse:add', 'wms:warehouse:edit', 'wms:warehouse:export', 'wms:warehouse:import',
    'wms:bill:add', 'wms:bill:edit', 'wms:bill:audit',
    'wms:inventory:export', 'wms:warn:list', 'wms:flow:list'
  ]
}

function filterTree(nodes, allowed) {
  if (allowed === null) return nodes
  return nodes
    .filter((n) => allowed.includes(n.id))
    .map((n) => (n.children ? { ...n, ...(n.children.length ? { children: filterTree(n.children, allowed) } : {}) } : n))
}

const ROLES = [
  { id: 1, code: 'admin', name: '超级管理员', remark: '全部权限', userCount: 1, menuIds: MENU_TREE.map((m) => m.id) },
  { id: 2, code: 'stock', name: '仓储专员', remark: '业务单据 + 库存，无删除与系统权限', userCount: 12, menuIds: ROLE_MENUS.stock }
]

// ============================================================
// 通用查询工具
// ============================================================
const IGNORE_KEYS = new Set(['page', 'pageSize', '_t'])

function isBlank(v) {
  return v === undefined || v === null || v === ''
}

/** 关键字模糊匹配：只在常见文本字段里找 */
const TEXT_FIELDS = ['name', 'code', 'contact', 'phone', 'address', 'goodsName', 'goodsCode', 'warehouseName', 'locationCode', 'batchNo', 'manager', 'spec']

function matchKeyword(row, keyword) {
  if (!keyword) return true
  const kw = String(keyword).trim().toLowerCase()
  if (!kw) return true
  return TEXT_FIELDS.some((f) => String(row[f] ?? '').toLowerCase().includes(kw))
}

/** 其余非空参数按字段等值匹配；onlyWarn 为业务专用开关 */
function matchFields(row, query) {
  for (const [k, v] of Object.entries(query)) {
    if (IGNORE_KEYS.has(k) || isBlank(v)) continue
    if (k === 'keyword') continue
    if (k === 'onlyWarn') {
      if (String(v) === '1' || String(v) === 'true') {
        if (!row.warning && !(row.safetyStock !== undefined && row.qty < row.safetyStock)) return false
      }
      continue
    }
    if (k === 'startDate' || k === 'endDate') continue
    if (row[k] === undefined) continue
    if (String(row[k]) !== String(v)) return false
  }
  return true
}

function matchDate(row, query) {
  const s = query.startDate ? new Date(String(query.startDate)).getTime() : null
  const e = query.endDate ? new Date(String(query.endDate)).getTime() : null
  if (s === null && e === null) return true
  const t = new Date(row.createTime || row.time || Date.now()).getTime()
  if (s !== null && t < s) return false
  if (e !== null && t > e + 86399000) return false
  return true
}

function paginate(list, query) {
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(500, Math.max(1, Number(query.pageSize) || 20))
  const start = (page - 1) * pageSize
  return {
    list: list.slice(start, start + pageSize),
    total: list.length,
    page,
    pageSize
  }
}

function filterList(list, query) {
  return list.filter((r) => matchKeyword(r, query.keyword) && matchFields(r, query) && matchDate(r, query))
}

/** 数据权限过滤：WAREHOUSE 作用域只能看所属仓库 */
function scopeFilter(list, user) {
  if (!user || user.dataScope === 'ALL') return list
  return list.filter((r) => r.warehouseId === undefined || user.warehouseIds.includes(r.warehouseId))
}

// ============================================================
// 单据状态机（服务端兜底）
// ============================================================
const STATUS_FLOW = {
  DRAFT: ['PENDING', 'CANCELED'],
  PENDING: ['APPROVED', 'CANCELED', 'DRAFT'],
  APPROVED: ['RUNNING', 'CANCELED'],
  RUNNING: ['FINISHED', 'CANCELED'],
  FINISHED: [],
  // 作废允许退回草稿重新编辑，与前端 STATUS_FLOW 保持一致
  CANCELED: ['DRAFT']
}
const STATUS_LABEL = {
  DRAFT: '草稿',
  PENDING: '待审核',
  APPROVED: '已审核',
  RUNNING: '执行中',
  FINISHED: '已完成',
  CANCELED: '已取消'
}

// ============================================================
// App
// ============================================================
const app = express()
app.use(cors())
app.use(express.json({ limit: '5mb' }))

/** 鉴权中间件：登录/刷新/健康检查/大屏放行 */
app.use('/api', (req, res, next) => {
  const p = req.path
  // 大屏用于投屏展示，按 README 承诺免登录；仅开放只读聚合接口，不涉及任何写操作
  const isPublic =
    p.startsWith('/auth/login') || p.startsWith('/auth/refresh') || p === '/health' || p.startsWith('/screen/')
  if (isPublic) return next()
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  const body = parseToken(token)
  if (!body || body.type !== 'access') {
    // 401 交给前端拦截器触发无感刷新
    return res.status(401).json({ code: 401, data: null, msg: '登录状态已失效' })
  }
  req.user = ACCOUNTS.find((a) => a.username === body.sub) || ACCOUNTS[0]
  next()
})

// ---------------- 认证 ----------------
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {}
  const acc = ACCOUNTS.find((a) => a.username === username)
  if (!acc || acc.password !== password) return fail(res, '用户名或密码错误', 401)

  const accessToken = issueToken({ sub: acc.username, type: 'access' }, ACCESS_TTL)
  const refreshToken = issueToken({ sub: acc.username, type: 'refresh' }, REFRESH_TTL)
  refreshStore.set(refreshToken, acc.username)
  ok(res, { accessToken, refreshToken })
})

app.post('/api/auth/refresh', (req, res) => {
  const { refreshToken } = req.body || {}
  const body = parseToken(refreshToken)
  if (!body || body.type !== 'refresh' || !refreshStore.has(refreshToken)) {
    return fail(res, 'refreshToken 无效或已失效，请重新登录', 401)
  }
  // 轮换：作废旧 refresh，下发新的一对，避免 refresh 被长期复用
  refreshStore.delete(refreshToken)
  const accessToken = issueToken({ sub: body.sub, type: 'access' }, ACCESS_TTL)
  const nextRefresh = issueToken({ sub: body.sub, type: 'refresh' }, REFRESH_TTL)
  refreshStore.set(nextRefresh, body.sub)
  ok(res, { accessToken, refreshToken: nextRefresh })
})

app.get('/api/auth/user-info', (req, res) => {
  const u = req.user
  const perms = u.roles.includes('admin') ? ROLE_PERMISSIONS.admin : ROLE_PERMISSIONS.stock
  ok(res, {
    user: {
      id: u.id,
      username: u.username,
      nickname: u.nickname,
      avatar: '',
      dept: u.dept,
      dataScope: u.dataScope,
      warehouseIds: u.warehouseIds
    },
    roles: u.roles,
    permissions: perms
  })
})

app.get('/api/auth/routes', (req, res) => {
  const u = req.user
  const allowed = u.roles.includes('admin') ? null : ROLE_MENUS.stock
  ok(res, filterTree(MENU_TREE, allowed))
})

app.post('/api/auth/logout', (req, res) => ok(res, null))

// ---------------- 系统管理 ----------------
app.get('/api/system/user/list', (req, res) => {
  const rows = ACCOUNTS.map((a, i) => ({
    id: a.id,
    username: a.username,
    nickname: a.nickname,
    dept: a.dept,
    phone: a.id === 1 ? '138****8888' : '139****6666',
    roleName: a.roles.includes('admin') ? '超级管理员' : '仓储专员',
    dataScope: a.dataScope,
    warehouseIds: a.warehouseIds, 
    status: 1,
    createTime: new Date(Date.now() - (i + 1) * 86400000 * 30).toISOString()
  }))
  ok(res, paginate(filterList(rows, req.query), req.query))
})

app.get('/api/system/role/list', (_req, res) => ok(res, ROLES))
app.get('/api/system/menu/list', (_req, res) => ok(res, MENU_TREE))

// ---------------- 基础数据（商品/供应商/客户/仓库）----------------
const REPOS = {
  goods: { list: goods, seq: { v: goods.length }, prefix: 'G' },
  supplier: { list: suppliers, seq: { v: suppliers.length }, prefix: 'S' },
  customer: { list: customers, seq: { v: customers.length }, prefix: 'C' },
  warehouse: { list: warehouses, seq: { v: warehouses.length }, prefix: 'W' }
}

function repoOf(name) {
  const r = REPOS[name]
  if (!r) {
    const err = new Error('UNKNOWN_REPO')
    err.status = 404
    throw err
  }
  return r
}

app.get('/api/base/:repo/list', (req, res) => {
  try {
    const r = repoOf(req.params.repo)
    ok(res, paginate(filterList(r.list, req.query), req.query))
  } catch (e) {
    fail(res, '资源不存在', 404)
  }
})

app.get('/api/base/:repo/all', (req, res) => {
  try {
    const r = repoOf(req.params.repo)
    ok(res, r.list)
  } catch {
    fail(res, '资源不存在', 404)
  }
})

app.post('/api/base/:repo/save', (req, res) => {
  try {
    const r = repoOf(req.params.repo)
    const data = req.body || {}
    if (data.id) {
      const idx = r.list.findIndex((x) => x.id === Number(data.id))
      if (idx === -1) return fail(res, '记录不存在', 404)
      r.list[idx] = { ...r.list[idx], ...data, id: Number(data.id) }
      return ok(res, r.list[idx].id)
    }
    const id = ++r.seq.v
    const row = {
      id,
      code: data.code || `${r.prefix}${String(id).padStart(5, '0')}`,
      status: data.status ?? 1,
      createTime: new Date().toISOString(),
      ...data
    }
    r.list.unshift(row)
    ok(res, id)
  } catch {
    fail(res, '资源不存在', 404)
  }
})

app.delete('/api/base/:repo/delete/:id', (req, res) => {
  try {
    const r = repoOf(req.params.repo)
    const id = Number(req.params.id)
    const idx = r.list.findIndex((x) => x.id === id)
    if (idx === -1) return fail(res, '记录不存在', 404)
    r.list.splice(idx, 1)
    ok(res, null)
  } catch {
    fail(res, '资源不存在', 404)
  }
})

// ---------------- 业务单据 ----------------
let billSeq = bills.reduce((m, b) => Math.max(m, b.id), 1000)

function recalc(bill) {
  const items = bill.items || []
  bill.totalQty = items.reduce((s, i) => s + (bill.bizType === 'CHECK' ? Math.abs(Number(i.qty) || 0) : Number(i.qty) || 0), 0)
  bill.totalAmount = Number(
    items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.price) || 0), 0).toFixed(2)
  )
  return bill
}

app.get('/api/biz/bill/list', (req, res) => {
  const q = req.query || {}
  let list = bills.filter((b) => !q.bizType || b.bizType === q.bizType)
  list = scopeFilter(list, req.user)
  list = filterList(list, q).sort((a, b) => (a.createTime < b.createTime ? 1 : -1))
  ok(res, paginate(list, q))
})

app.get('/api/biz/bill/detail/:id', (req, res) => {
  const b = bills.find((x) => x.id === Number(req.params.id))
  if (!b) return fail(res, '单据不存在', 404)
  ok(res, b)
})

app.post('/api/biz/bill/save', (req, res) => {
  const p = req.body || {}
  if (!p.bizType || !['PURCHASE', 'SALE', 'CHECK'].includes(p.bizType)) return fail(res, '业务类型非法')
  if (!Array.isArray(p.items) || !p.items.length) return fail(res, '单据明细不能为空')

  // 明细行统一在服务端算金额，避免前端篡改单价/数量导致金额不一致
  const items = p.items.map((it, i) => {
    const qty = Number(it.qty) || 0
    const price = Number(it.price) || 0
    const bookQty = Number(it.bookQty ?? 0)
    const realQty = Number(it.realQty ?? 0)
    return {
      id: i + 1,
      goodsId: it.goodsId,
      goodsCode: it.goodsCode || '',
      goodsName: it.goodsName || '',
      spec: it.spec || '',
      unit: it.unit || '',
      qty,
      price,
      amount: Number((qty * price).toFixed(2)),
      bookQty,
      realQty,
      diffQty: realQty - bookQty
    }
  })

  if (p.id) {
    const bill = bills.find((x) => x.id === Number(p.id))
    if (!bill) return fail(res, '单据不存在', 404)
    if (['FINISHED', 'RUNNING'].includes(bill.status)) return fail(res, `${STATUS_LABEL[bill.status]}的单据不允许修改`)
    // 编辑时同步落库目标状态（此前只写业务字段，导致「提交审核」后仍是草稿）
    if (p.status && p.status !== bill.status) {
      const allowed = STATUS_FLOW[bill.status] || []
      if (!allowed.includes(p.status)) {
        return fail(res, `状态流转非法：${STATUS_LABEL[bill.status]} → ${STATUS_LABEL[p.status] || p.status}`)
      }
    }
    Object.assign(bill, {
      status: p.status && STATUS_LABEL[p.status] ? p.status : bill.status,
      warehouseId: p.warehouseId,
      warehouseName: warehouses.find((w) => w.id === Number(p.warehouseId))?.name || bill.warehouseName,
      partnerId: p.partnerId ?? bill.partnerId,
      remark: p.remark ?? '',
      items
    })
    recalc(bill)
    return ok(res, bill.id)
  }

  const id = ++billSeq
  const prefix = p.bizType === 'PURCHASE' ? 'PO' : p.bizType === 'SALE' ? 'SO' : 'CK'
  const bill = recalc({
    id,
    code: `${prefix}${String(20260000 + id).slice(-8)}`,
    bizType: p.bizType,
    status: p.status || 'DRAFT',
    warehouseId: p.warehouseId,
    warehouseName: warehouses.find((w) => w.id === Number(p.warehouseId))?.name || '',
    partnerId: p.partnerId || 0,
    partnerName: '',
    totalQty: 0,
    totalAmount: 0,
    remark: p.remark || '',
    creator: req.user?.nickname || '系统',
    createTime: new Date().toISOString(),
    items
  })
  bills.unshift(bill)
  ok(res, id)
})

app.delete('/api/biz/bill/delete/:id', (req, res) => {
  const idx = bills.findIndex((x) => x.id === Number(req.params.id))
  if (idx === -1) return fail(res, '单据不存在', 404)
  const bill = bills[idx]
  if (!['DRAFT', 'CANCELED'].includes(bill.status)) {
    return fail(res, `仅草稿 / 已取消的单据可删除（当前：${STATUS_LABEL[bill.status]}）`)
  }
  bills.splice(idx, 1)
  ok(res, null)
})

app.post('/api/biz/bill/transfer', (req, res) => {
  const { id, target } = req.body || {}
  const bill = bills.find((x) => x.id === Number(id))
  if (!bill) return fail(res, '单据不存在', 404)
  const allowed = STATUS_FLOW[bill.status] || []
  if (!allowed.includes(target)) {
    return fail(res, `状态流转非法：${STATUS_LABEL[bill.status]} → ${STATUS_LABEL[target] || target}`)
  }
  bill.status = target
  ok(res, null)
})

// ---------------- 库存 ----------------
app.get('/api/stock/inventory/list', (req, res) => {
  const q = req.query || {}
  const all = getInventory(100000)
  let list = scopeFilter(all, req.user)
  if (q.category) list = list.filter((r) => r.category === q.category)
  list = filterList(list, q)
  ok(res, paginate(list, q))
})

app.get('/api/stock/inventory/all', (req, res) => {
  const size = Math.min(200000, Math.max(100, Number(req.query.size) || 100000))
  // 与分页接口一致，先做数据范围过滤再精简字段，否则 WAREHOUSE 作用域可看到全部仓库
  const all = scopeFilter(getInventory(size), req.user)
  // 全量接口只回传虚拟滚动所需字段，10 万行体积约 12MB -> 精简后约 6MB
  ok(res, all.map(toLightInventory))
})

app.get('/api/stock/warn', (req, res) => ok(res, scopeFilter(buildWarns(), req.user)))
app.get('/api/stock/flow', (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 50))
  ok(res, scopeFilter(flows, req.user).slice(0, limit))
})

// ---------------- BI 大屏 ----------------
let screenCache = { at: 0, data: null }
app.get('/api/screen/overview', (_req, res) => {
  // 3 秒级缓存：大屏首屏全量计算较重，避免高频刷新打满 CPU
  if (!screenCache.data || Date.now() - screenCache.at > 3000) {
    screenCache = { at: Date.now(), data: buildScreen() }
  }
  ok(res, screenCache.data)
})

app.get('/api/health', (_req, res) => ok(res, { status: 'UP', time: new Date().toISOString() }))

// ============================================================
// AI 模块
// ============================================================
/**
 * 模型接入抽象层：
 *   - 配置 AI_API_BASE + AI_API_KEY + AI_MODEL 时走真实大模型（OpenAI 兼容协议，stream: true）
 *   - 未配置时降级为内置离线模拟模型，前端逻辑与流式体验完全一致
 * 这样简历里可以如实写「模型可插拔，未配置 Key 时本地降级」，而不是假装接了模型。
 */
const AI_API_BASE = process.env.AI_API_BASE || ''
const AI_API_KEY = process.env.AI_API_KEY || ''
const AI_MODEL = process.env.AI_MODEL || 'qwen-plus'

async function* callRealModel(messages) {
  const resp = await fetch(`${AI_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_API_KEY}` },
    body: JSON.stringify({ model: AI_MODEL, messages, stream: true, temperature: 0.3 })
  })
  if (!resp.ok || !resp.body) throw new Error(`模型请求失败：${resp.status}`)
  const reader = resp.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() || ''
    for (const line of lines) {
      const t = line.trim()
      if (!t.startsWith('data:')) continue
      const payload = t.slice(5).trim()
      if (payload === '[DONE]') return
      try {
        const json = JSON.parse(payload)
        const delta = json.choices?.[0]?.delta?.content
        if (delta) yield delta
      } catch {
        /* 忽略心跳帧 */
      }
    }
  }
}

// ---------------- Function Calling：把自然语言转成结构化查询 ----------------
function toolTrend() {
  const trend = buildScreen().trend.slice(-14)
  return {
    name: 'query_trend',
    chart: 'line',
    columns: [
      { label: '日期', prop: 'date' },
      { label: '入库量', prop: 'inQty' },
      { label: '出库量', prop: 'outQty' }
    ],
    rows: trend,
    summary: `近 ${trend.length} 天出入库趋势：累计入库 ${trend.reduce((s, r) => s + r.inQty, 0).toLocaleString('zh-CN')} 件，出库 ${trend.reduce((s, r) => s + r.outQty, 0).toLocaleString('zh-CN')} 件。`
  }
}

function toolCategory() {
  const cat = buildScreen().category.sort((a, b) => b.value - a.value)
  const total = cat.reduce((s, c) => s + c.value, 0)
  return {
    name: 'query_category',
    chart: 'pie',
    columns: [
      { label: '品类', prop: 'name' },
      { label: '库存量', prop: 'value' }
    ],
    rows: cat,
    summary: `库存结构：${cat[0]?.name}占比最高（${((cat[0]?.value / total) * 100).toFixed(1)}%），共 ${cat.length} 个品类，合计 ${total.toLocaleString('zh-CN')} 件。`
  }
}

function toolWarehouseRank() {
  const inv = getInventory(10000)
  const map = new Map()
  inv.forEach((r) => map.set(r.warehouseName, (map.get(r.warehouseName) || 0) + r.qty))
  const rows = Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
  return {
    name: 'query_warehouse_rank',
    chart: 'bar',
    columns: [
      { label: '仓库', prop: 'name' },
      { label: '库存量', prop: 'value' }
    ],
    rows,
    summary: `仓库库存排行：${rows[0]?.name} 最高（${rows[0]?.value.toLocaleString('zh-CN')} 件），末位 ${rows[rows.length - 1]?.name}（${rows[rows.length - 1]?.value.toLocaleString('zh-CN')} 件）。`
  }
}

function toolSupplierRank() {
  const rows = buildScreen().supplierRank.slice(0, 8)
  return {
    name: 'query_supplier_rank',
    chart: 'bar',
    columns: [
      { label: '供应商', prop: 'name' },
      { label: '采购额', prop: 'value' }
    ],
    rows,
    summary: `供应商采购额 TOP${rows.length}，头部 ${rows[0]?.name} 占比 ${((rows[0]?.value / rows.reduce((s, r) => s + r.value, 0)) * 100).toFixed(1)}%。`
  }
}

function toolWarnTable() {
  const rows = buildWarns().slice(0, 12)
  return {
    name: 'query_warn',
    chart: 'table',
    columns: [
      { label: '商品', prop: 'goodsName' },
      { label: '仓库', prop: 'warehouseName' },
      { label: '现有量', prop: 'qty' },
      { label: '安全库存', prop: 'safetyStock' },
      { label: '缺口', prop: 'gapQty' }
    ],
    rows,
    summary: `缺货预警 ${rows.length} 条，其中高危 ${rows.filter((r) => r.level === 'HIGH').length} 条，建议优先补货前 3 项。`
  }
}

/** 智能填单：从自然语言里解析「商品名 + 数量」 */
function matchGoods(namePart) {
  // 逐级降级匹配：完整名 -> 去掉尾部型号 -> 拆分出的中文词，尽量命中商品档案
  const cleaned = namePart.replace(/[0-9a-zA-Z]+$/, '').trim()
  const tokens = [namePart, cleaned, ...namePart.split(/[^\u4e00-\u9fa5]+/).filter((t) => t.length >= 2)]
  for (const t of tokens) {
    if (!t) continue
    const hit = goods.find((g) => g.name.includes(t))
    if (hit) return hit
  }
  return null
}

function toolFillBill(text) {
  const segments = text.split(/[,，、;；]+/).filter(Boolean)
  const rows = []
  const missed = []
  segments.forEach((seg) => {
    const m = seg.trim().match(/^(.*?)(\d+)\s*([a-zA-Z\u4e00-\u9fa5]*)$/)
    if (!m) return
    const namePart = m[1].replace(/^(采购|入库|出库|销售|盘点|补货|领用|下单|来|要)/, '').trim()
    const qty = Number(m[2])
    if (!namePart || !qty) return
    const hit = matchGoods(namePart)
    if (!hit) {
      missed.push(namePart)
      return
    }
    const price = /出库|销售/.test(text) ? hit.salePrice : hit.purchasePrice
    rows.push({
      goodsId: hit.id,
      goodsCode: hit.code,
      goodsName: hit.name,
      spec: hit.spec,
      unit: hit.unit,
      qty,
      price,
      amount: Number((qty * price).toFixed(2))
    })
  })
  return {
    name: 'fill_bill',
    chart: 'table',
    columns: [
      { label: '商品', prop: 'goodsName' },
      { label: '规格', prop: 'spec' },
      { label: '数量', prop: 'qty' },
      { label: '单价', prop: 'price' },
      { label: '金额', prop: 'amount' }
    ],
    rows,
    summary: rows.length
      ? `已识别 ${rows.length} 条明细并回填到单据${missed.length ? `，未匹配到商品：${missed.join('、')}` : ''}。`
      : '未能从这句话里识别出商品与数量，可以试试「采购 螺帽M8 200个，法兰盘 50件」。'
  }
}

/** 意图识别：真实场景由模型做 Function Calling，这里用规则兜底 */
function detectTool(scene, text) {
  // 纯咨询类问题不查数据，避免「如何降低呆滞占比」被误判成查品类占比
  if (scene === 'chat' && /(如何|怎么|为什么|原因|建议|风险|逻辑|解释|是什么)/.test(text)) return null
  if (scene === 'fill' || /^(采购|入库|出库|销售|下单|补货)|填单|来\d|要\d/.test(text)) return toolFillBill(text)
  if (/趋势|走势|近\s*\d+\s*天|每天/.test(text)) return toolTrend()
  if (/占比|结构|品类|分类/.test(text)) return toolCategory()
  if (/供应商|采购额/.test(text)) return toolSupplierRank()
  if (/预警|缺货|低于安全/.test(text)) return toolWarnTable()
  if (/排行|最高|最多|TOP|仓库/.test(text)) return toolWarehouseRank()
  return null
}

function offlineAnswer(scene, text, tool) {
  const screen = buildScreen()
  const kpi = Object.fromEntries(screen.kpi.map((k) => [k.key, k]))
  if (scene === 'fill' || tool?.name === 'fill_bill') {
    return `已按你的描述解析出单据明细并回填到右侧表单。

- 共识别 **${tool?.rows.length || 0}** 行，单价自动带出商品档案价
- 金额 = 数量 × 单价，服务端会重新核算，不会被前端改写
- 提交前请确认仓库与供应商/客户，保存后状态为「草稿」，走完审核才会影响库存

如需调整数量，直接改表格里的数量列即可，金额会实时联动。`
  }
  if (scene === 'explain' || /为什么|原因|解读|分析一下/.test(text)) {
    return `## 指标解读

**结论**：${kpi.fulfill.label}当前 ${kpi.fulfill.value}${kpi.fulfill.unit}，环比 ${(kpi.fulfill.mom * 100).toFixed(1)}%；${kpi.warn.label}为 ${kpi.warn.value}${kpi.warn.unit}，是拖累履约率的主因。

**拆解**
1. **供给端**：${kpi.warn.value} 个 SKU 低于安全库存，缺口集中在 ${buildWarns()[0]?.warehouseName || '华南中心仓'}，采购到货周期拉长导致出库兑现率下降。
2. **周转端**：库存周转率 ${kpi.turnover.value}${kpi.turnover.unit}，${kpi.turnover.mom >= 0 ? '高于' : '低于'}上月，说明畅销品备货不足、长尾品积压并存。
3. **结构端**：${screen.category.sort((a, b) => b.value - a.value)[0]?.name}占比最高，品类集中度偏高，单一品类波动会被放大。

**建议动作**
- 对高危缺货 SKU 按「缺口 × 日均出库」下补货单，优先走 A 级供应商加急通道
- 长尾库存做 ABC 分级，C 类设最低陈列量，释放仓位与资金
- 履约率按仓库拆解考核，避免整体指标掩盖单仓问题`
  }
  if (/安全库存|库存管理|风险|呆滞|降低/.test(text)) {
    return `## 库存管理要点

**1. 安全库存怎么定**
安全库存 = 日均出库量 × 采购提前期 + 波动缓冲。本项目里每个商品都维护了 \`safetyStock\` 字段，台账实时比对 \`qty < safetyStock\` 触发预警，按缺口大小分 HIGH / MIDDLE / LOW 三级。

**2. 当前主要风险**
- 缺货风险：${kpi.warn.value} 个 SKU 低于安全库存，其中高危 ${buildWarns().filter((w) => w.level === 'HIGH').length} 个
- 呆滞风险：长尾品类周转天数明显高于均值，占用仓位与资金
- 效期风险：台账里有 \`expireDate\`，临期商品应优先出库（FEFO）

**3. 降低呆滞的三件事**
1. ABC 分级：A 类高周转重点保障，C 类设最低陈列量
2. 效期预警：临期 30 天内自动进入待处理清单
3. 跨仓调拨：把呆滞品调往需求仓，避免单边积压`
  }
  if (tool) {
    return `已按你的问题查到数据，结果见上方表格/图表。

${tool.summary}

如需进一步下钻（比如只看某个仓库、或换成按品类看），直接说条件即可。`
  }
  return `我是 SmartWMS 的智能助手，可以帮你：

- **查数据**：「近 30 天出库趋势」「各品类库存占比」「哪个仓库库存最高」
- **填单据**：「采购 螺帽M8 200个，法兰盘 50件」，识别后自动回填明细
- **解读指标**：「为什么本月履约率下降」，给出归因与建议动作

当前系统：${screen.kpi.length} 个核心指标、${goods.length} 个商品档案、${warehouses.length} 个仓库，库存台账 ${getInventory(1000).length ? '10 万行' : ''} 级数据量。`
}

// ---------------- SSE 对话 ----------------
function sseFrame(res, event, data) {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

app.post('/api/ai/chat', async (req, res) => {
  const { message = '', scene = 'chat', history = [] } = req.body || {}

  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no' // 关闭 Nginx 缓冲，否则流式会被攒成一坨
  })
  res.flushHeaders?.()

  // 注意用 res 而不是 req 监听：Node 16+ 请求体读完后 req 就会触发 close，
  // 那会导致流刚开始就被判定为「已中断」，一帧都推不出去
  let aborted = false
  res.on('close', () => {
    aborted = true
  })

  try {
    // 1) Function Calling：先判定是否要查数据 / 填单
    const tool = detectTool(scene, message)
    if (tool) {
      await sleep(180)
      if (!aborted) sseFrame(res, 'tool', { type: 'tool', tool })
    }

    // 2) 生成回答文本并逐段推送
    const push = async (text) => {
      const step = 3
      for (let i = 0; i < text.length; i += step) {
        if (aborted) return
        sseFrame(res, 'delta', { type: 'delta', text: text.slice(i, i + step) })
        await sleep(16)
      }
    }

    if (AI_API_BASE && AI_API_KEY) {
      const systemPrompt =
        '你是 SmartWMS 仓储管理系统的智能助手，回答面向仓储运营人员，简洁、给结论、给可执行动作，使用 Markdown。'
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-6),
        { role: 'user', content: message }
      ]
      if (tool) messages.push({ role: 'system', content: `已查询到结构化数据：${tool.summary}` })
      for await (const delta of callRealModel(messages)) {
        if (aborted) return res.end()
        sseFrame(res, 'delta', { type: 'delta', text: delta })
      }
    } else {
      // 离线模拟模型：思考停顿 + 分段输出，体验与真实流式一致
      await sleep(220)
      await push(offlineAnswer(scene, message, tool))
    }

    if (!aborted) sseFrame(res, 'done', { type: 'done' })
    res.end()
  } catch (e) {
    if (!aborted) {
      sseFrame(res, 'error', { type: 'error', message: e.message || '生成失败' })
      res.end()
    }
  }
})

app.post('/api/ai/explain-warn', (_req, res) => {
  const warns = buildWarns()
  const high = warns.filter((w) => w.level === 'HIGH')
  const top = warns.slice(0, 3)
  const text = `## 缺货预警解读

当前共 ${warns.length} 个 SKU 低于安全库存，其中高危 ${high.length} 个，合计缺口 ${warns.reduce((s, w) => s + w.gapQty, 0)} 件。

**优先处理**
${top.map((w, i) => `${i + 1}. ${w.goodsName}（${w.warehouseName}）：现有 ${w.qty}，安全库存 ${w.safetyStock}，建议补货 ${w.gapQty} 件`).join('\n')}

**归因**：集中在少数仓库，说明是区域备货结构问题而非整体供给不足；建议先做跨仓调拨，再对仍未覆盖的缺口下采购单，预计可把高危数量压缩 40% 以上。`
  ok(res, { text })
})

// 404 兜底
app.use('/api', (req, res) => fail(res, `接口不存在：${req.method} ${req.originalUrl}`, 404))

// ============================================================
// 启动 + WebSocket
// ============================================================
const server = http.createServer(app)
const wss = new WebSocketServer({ noServer: true })

server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`)
  // 与前端 flowWsUrl() 保持一致：/api/screen/flow
  if (pathname === '/api/screen/flow') {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
  } else {
    socket.destroy()
  }
})

wss.on('connection', (ws) => {
  console.log('[ws] 大屏客户端已连接')
  const timer = setInterval(() => {
    if (ws.readyState !== ws.OPEN) return
    ws.send(JSON.stringify(makeFlow()))
  }, 2500)
  ws.on('close', () => {
    clearInterval(timer)
    console.log('[ws] 大屏客户端已断开')
  })
  ws.on('error', () => clearInterval(timer))
})

server.listen(PORT, () => {
  console.log(`\n  SmartWMS Mock 服务已启动`)
  console.log(`  HTTP  http://127.0.0.1:${PORT}/api`)
  console.log(`  WS    ws://127.0.0.1:${PORT}/api/screen/flow`)
  console.log(`  账号  admin / admin123（全量权限）  |  stock / 123456（仓库数据权限）\n`)
})
