/**
 * 接口冒烟脚本
 * ------------------------------------------------------------------
 * 用法：先启动 Mock 服务（npm run dev:api），另开终端执行 node server/smoke.mjs
 * 覆盖：鉴权与双 Token 轮换、RBAC 与数据权限、单据状态机、库存分页/全量、
 *       大屏数据、AI 的 SSE 流式与工具调用、WebSocket 实时推送
 */
import WebSocket from 'ws'

const BASE = 'http://127.0.0.1:48081/api'
let pass = 0
let fail = 0

function check(name, cond, extra = '') {
  if (cond) {
    pass++
    console.log(`  OK   ${name}${extra ? ' :: ' + extra : ''}`)
  } else {
    fail++
    console.log(`  FAIL ${name}${extra ? ' :: ' + extra : ''}`)
  }
}

async function json(path, options = {}) {
  const res = await fetch(BASE + path, options)
  return { status: res.status, body: await res.json() }
}

// ---------- 1. 健康检查 ----------
{
  const r = await json('/health')
  check('health', r.body.code === 200 && r.body.data.status === 'UP')
}

// ---------- 2. 登录 ----------
let adminToken = ''
let adminRefresh = ''
{
  const bad = await json('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'wrong' })
  })
  check('错误密码被拒绝', bad.body.code !== 200, bad.body.msg)

  const r = await json('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  })
  adminToken = r.body.data?.accessToken || ''
  adminRefresh = r.body.data?.refreshToken || ''
  check('admin 登录成功', !!adminToken && !!adminRefresh)

  const noAuth = await json('/auth/user-info')
  check('未携带 token 返回 401', noAuth.status === 401, String(noAuth.status))
}

// ---------- 3. 用户信息与动态路由 ----------
{
  const r = await json('/auth/user-info', { headers: { Authorization: `Bearer ${adminToken}` } })
  check('超管拥有 *:*', r.body.data?.permissions?.includes('*:*'), r.body.data?.user?.nickname)

  const routes = await json('/auth/routes', { headers: { Authorization: `Bearer ${adminToken}` } })
  const tree = routes.body.data || []
  check('菜单树一级节点数', tree.length === 4, `${tree.length} 个`)
  check('菜单子节点带 component', !!tree[0]?.children?.[0]?.component, tree[0]?.children?.[0]?.component)
}

// ---------- 4. 双 Token 轮换 ----------
{
  const r = await json('/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: adminRefresh })
  })
  check('refresh 换新 token', r.body.code === 200 && !!r.body.data?.accessToken)
  adminToken = r.body.data?.accessToken || adminToken

  const reuse = await json('/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: adminRefresh })
  })
  check('旧 refresh 已作废（轮换生效）', reuse.body.code !== 200, reuse.body.msg)
}

// ---------- 5. 基础数据 CRUD ----------
{
  const h = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
  const r = await json('/base/goods/list?page=1&pageSize=5', { headers: h })
  check('商品分页', r.body.data?.list?.length === 5 && r.body.data.total === 200, `total=${r.body.data?.total}`)

  const kw = await json('/base/goods/list?page=1&pageSize=5&keyword=' + encodeURIComponent('螺帽'), { headers: h })
  check('商品关键字搜索', kw.body.data.total > 0 && kw.body.data.total < 200, `命中 ${kw.body.data?.total}`)

  const save = await json('/base/goods/save', {
    method: 'POST',
    headers: h,
    body: JSON.stringify({ name: '冒烟测试商品', code: 'SMOKE001', category: 'RAW', unit: '件', status: 1 })
  })
  check('商品新增', save.body.code === 200, `id=${save.body.data}`)

  const del = await json(`/base/goods/delete/${save.body.data}`, { method: 'DELETE', headers: h })
  check('商品删除', del.body.code === 200)
}

// ---------- 6. 单据与状态机 ----------
{
  const h = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
  const r = await json('/biz/bill/list?bizType=PURCHASE&page=1&pageSize=3', { headers: h })
  check('采购单列表', r.body.data?.list?.length === 3, `total=${r.body.data?.total}`)

  const created = await json('/biz/bill/save', {
    method: 'POST',
    headers: h,
    body: JSON.stringify({
      bizType: 'PURCHASE',
      warehouseId: 1,
      items: [{ goodsId: 1, goodsName: '测试商品', qty: 10, price: 5 }]
    })
  })
  const billId = created.body.data
  check('单据新增（服务端重算金额）', created.body.code === 200, `id=${billId}`)

  const jump = await json('/biz/bill/transfer', {
    method: 'POST',
    headers: h,
    body: JSON.stringify({ id: billId, target: 'FINISHED' })
  })
  check('状态机拒绝跳级', jump.body.code !== 200, jump.body.msg)

  const ok = await json('/biz/bill/transfer', {
    method: 'POST',
    headers: h,
    body: JSON.stringify({ id: billId, target: 'PENDING' })
  })
  check('状态机允许 DRAFT → PENDING', ok.body.code === 200)

  const delDeny = await json(`/biz/bill/delete/${billId}`, { method: 'DELETE', headers: h })
  check('待审核单据禁止删除', delDeny.body.code !== 200, delDeny.body.msg)

  const cancel = await json('/biz/bill/transfer', {
    method: 'POST',
    headers: h,
    body: JSON.stringify({ id: billId, target: 'CANCELED' })
  })
  const delOk = await json(`/biz/bill/delete/${billId}`, { method: 'DELETE', headers: h })
  check('作废后可删除', cancel.body.code === 200 && delOk.body.code === 200)
}

// ---------- 7. 库存 ----------
{
  const h = { Authorization: `Bearer ${adminToken}` }
  const r = await json('/stock/inventory/list?page=1&pageSize=10', { headers: h })
  check('库存分页', r.body.data?.list?.length === 10 && r.body.data.total === 100000, `total=${r.body.data?.total}`)

  const t0 = Date.now()
  const all = await json('/stock/inventory/all?size=20000', { headers: h })
  check('库存全量返回', all.body.data?.length === 20000, `${all.body.data?.length} 行 / ${Date.now() - t0} ms`)
  check('全量走字段投影', !('produceDate' in (all.body.data?.[0] || {})))

  const warn = await json('/stock/warn', { headers: h })
  check('缺货预警', Array.isArray(warn.body.data) && warn.body.data.length > 0, `${warn.body.data?.length} 条`)

  const flow = await json('/stock/flow?limit=8', { headers: h })
  check('出入库流水', flow.body.data?.length === 8)
}

// ---------- 8. 大屏 ----------
{
  const r = await json('/screen/overview', { headers: { Authorization: `Bearer ${adminToken}` } })
  const d = r.body.data || {}
  check(
    '大屏全量数据',
    d.kpi?.length === 4 && d.trend?.length === 30 && d.category?.length > 0 && d.heat?.length === 40,
    `kpi=${d.kpi?.length} trend=${d.trend?.length} heat=${d.heat?.length}`
  )

  // 大屏用于投屏，按 README 承诺免登录：不带 token 也必须 200
  const pub = await json('/screen/overview')
  check('大屏免登录可访问', pub.status === 200 && pub.body.code === 200, `HTTP ${pub.status}`)

  // 但业务接口仍必须鉴权，不能被白名单连带放开
  const guarded = await json('/stock/warn')
  check('业务接口仍需登录', guarded.status === 401, `HTTP ${guarded.status}`)
}

// ---------- 9. 数据权限 ----------
{
  const lg = await json('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'stock', password: '123456' })
  })
  const h = { Authorization: `Bearer ${lg.body.data?.accessToken}` }
  const info = await json('/auth/user-info', { headers: h })
  check('stock 无删除权限', !info.body.data.permissions.includes('wms:goods:delete'))

  const routes = await json('/auth/routes', { headers: h })
  check('stock 无系统管理菜单', routes.body.data.length === 3, `${routes.body.data.length} 个一级菜单`)

  const inv = await json('/stock/inventory/list?page=1&pageSize=5', { headers: h })
  const ids = new Set((inv.body.data.list || []).map((r) => r.warehouseId))
  check('stock 仅可见所属仓库', [...ids].every((i) => [1, 6].includes(i)), `仓库 ${[...ids].join(',')}`)

  // 全量 / 预警 / 流水三个接口此前漏做数据范围过滤，这里一并守住
  const allRes = await json('/stock/inventory/all?size=2000', { headers: h })
  const allIds = new Set((allRes.body.data || []).map((r) => r.warehouseId))
  check('全量接口受数据权限约束', [...allIds].every((i) => [1, 6].includes(i)), `仓库 ${[...allIds].join(',')}`)

  const warnRes = await json('/stock/warn', { headers: h })
  const warnIds = new Set((warnRes.body.data || []).map((r) => r.warehouseId))
  check('预警接口受数据权限约束', [...warnIds].every((i) => [1, 6].includes(i)), `仓库 ${[...warnIds].join(',')}`)

  const flowRes = await json('/stock/flow?limit=50', { headers: h })
  const flowIds = new Set((flowRes.body.data || []).map((r) => r.warehouseId))
  check('流水接口受数据权限约束', [...flowIds].every((i) => [1, 6].includes(i)), `仓库 ${[...flowIds].join(',')}`)
}

// ---------- 10. AI：SSE 流式 + 工具调用 ----------
async function sseChat(scene, message) {
  const res = await fetch(BASE + '/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ sessionId: 'smoke', message, scene, history: [] })
  })
  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buf = ''
  let text = ''
  const tools = []
  let done = false
  const t0 = Date.now()
  let firstByteMs = null
  while (!done) {
    const { value, done: finished } = await reader.read()
    if (finished) break
    if (firstByteMs === null) firstByteMs = Date.now() - t0
    buf += decoder.decode(value, { stream: true })
    let idx
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const frame = buf.slice(0, idx)
      buf = buf.slice(idx + 2)
      let event = 'message'
      let data = ''
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data += line.slice(5).trim()
      }
      if (!data) continue
      const p = JSON.parse(data)
      if (p.type === 'delta') text += p.text
      else if (p.type === 'tool') tools.push(p.tool)
      else if (p.type === 'done') done = true
    }
  }
  return { text, tools, firstByteMs }
}

{
  const r = await sseChat('query', '近 30 天出入库趋势如何？')
  check('AI 查询意图产出工具结果', r.tools.length === 1 && r.tools[0].chart === 'line', `tool=${r.tools[0]?.name}`)
  check('AI 流式文本非空', r.text.length > 20, `${r.text.length} 字 / 首字节 ${r.firstByteMs}ms`)

  const fill = await sseChat('fill', '采购 螺帽 200个，不锈钢板 50张')
  const rows = fill.tools[0]?.rows || []
  check('AI 智能填单解析明细', rows.length === 2, JSON.stringify(rows.map((x) => `${x.goodsName}×${x.qty}`)))

  const explain = await sseChat('explain', '为什么本月履约率下降了？')
  check('AI 报表解读', explain.text.includes('履约率'), `${explain.text.length} 字`)

  const warnExplain = await json('/ai/explain-warn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({})
  })
  check('AI 预警解读', !!warnExplain.body.data?.text, `${warnExplain.body.data?.text?.length} 字`)
}

// ---------- 11. WebSocket 实时流水 ----------
await new Promise((resolve) => {
  const ws = new WebSocket('ws://127.0.0.1:48081/api/screen/flow')
  let got = 0
  ws.on('message', (raw) => {
    try {
      const item = JSON.parse(raw.toString())
      if (item.id && item.ioType) got++
    } catch {
      /* 忽略心跳 */
    }
    if (got >= 2) {
      check('WebSocket 推送流水', true, `${got} 条`)
      ws.close()
      resolve()
    }
  })
  ws.on('error', (e) => {
    check('WebSocket 推送流水', false, e.message)
    resolve()
  })
  setTimeout(() => {
    if (got < 2) {
      check('WebSocket 推送流水', got >= 2, `超时，仅收到 ${got} 条`)
      ws.close()
      resolve()
    }
  }, 8000)
})

console.log(`\n  冒烟结果：${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
