/** 后端统一返回结构中的分页数据 */
export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

export interface PageQuery {
  page?: number
  pageSize?: number
  [key: string]: unknown
}

// ---------------- 账户与权限 ----------------
export interface LoginPayload {
  username: string
  password: string
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
}

export interface UserProfile {
  id: number
  username: string
  nickname: string
  avatar: string
  dept: string
  /** 数据权限范围：全部 / 本仓库 */
  dataScope: 'ALL' | 'WAREHOUSE'
  warehouseIds: number[]
}

export interface UserInfo {
  user: UserProfile
  roles: string[]
  permissions: string[]
}

/** 后端返回的动态路由节点 */
export interface RouteNode {
  id: number
  parentId: number
  name: string
  path: string
  /** 前端组件路径，相对 src/views，如 base/Goods.vue */
  component: string | null
  title: string
  icon: string
  sort: number
  /** 按钮权限标识集合 */
  permissions: string[]
  children?: RouteNode[]
}

// ---------------- 基础数据 ----------------
export interface Goods {
  id: number
  code: string
  name: string
  category: string
  spec: string
  unit: string
  purchasePrice: number
  salePrice: number
  safetyStock: number
  shelfLifeDays: number
  supplierId: number
  supplierName: string
  status: number
  createTime: string
}

export interface Supplier {
  id: number
  code: string
  name: string
  contact: string
  phone: string
  address: string
  level: string
  status: number
  createTime: string
}

export interface Customer {
  id: number
  code: string
  name: string
  contact: string
  phone: string
  address: string
  level: string
  status: number
  createTime: string
}

export interface Warehouse {
  id: number
  code: string
  name: string
  type: string
  province: string
  area: number
  locationCount: number
  manager: string
  status: number
  createTime: string
}

// ---------------- 业务单据 ----------------
/** 单据明细行（主子表结构） */
export interface BillItem {
  id?: number
  goodsId: number
  goodsCode: string
  goodsName: string
  spec: string
  unit: string
  qty: number
  price: number
  amount: number
  /** 盘点专用：账面数量 / 实盘数量 / 差异 */
  bookQty?: number
  realQty?: number
  diffQty?: number
}

export interface Bill {
  id: number
  code: string
  /** 业务类型：采购 / 销售 / 盘点 */
  bizType: 'PURCHASE' | 'SALE' | 'CHECK'
  status: string
  warehouseId: number
  warehouseName: string
  /** 采购=供应商，销售=客户，盘点为空 */
  partnerId: number
  partnerName: string
  totalQty: number
  totalAmount: number
  remark: string
  creator: string
  createTime: string
  items: BillItem[]
}

export interface BillPayload {
  id?: number
  bizType: 'PURCHASE' | 'SALE' | 'CHECK'
  warehouseId: number
  partnerId?: number
  remark?: string
  status?: string
  items: BillItem[]
}

// ---------------- 库存 ----------------
export interface Inventory {
  id: number
  goodsId: number
  goodsCode: string
  goodsName: string
  spec: string
  category: string
  unit: string
  warehouseId: number
  warehouseName: string
  locationCode: string
  qty: number
  lockQty: number
  safetyStock: number
  batchNo: string
  produceDate: string
  expireDate: string
  /** 是否低于安全库存 */
  warning: boolean
}

export interface StockWarnItem {
  id: number
  goodsName: string
  goodsCode: string
  warehouseName: string
  qty: number
  safetyStock: number
  gapQty: number
  level: 'HIGH' | 'MIDDLE' | 'LOW'
  expireInDays: number
}

export interface FlowItem {
  id: number
  time: string
  ioType: string
  goodsName: string
  warehouseName: string
  qty: number
  billCode: string
}

// ---------------- BI 大屏 ----------------
export interface KpiItem {
  key: string
  label: string
  value: number
  unit: string
  /** 环比，正为上升 */
  mom: number
  icon: string
}

export interface TrendPoint {
  date: string
  inQty: number
  outQty: number
}

export interface RankItem {
  name: string
  value: number
}

export interface CategorySlice {
  name: string
  value: number
}

export interface HeatCell {
  warehouse: string
  zone: string
  value: number
}

export interface ScreenData {
  kpi: KpiItem[]
  trend: TrendPoint[]
  category: CategorySlice[]
  supplierRank: RankItem[]
  customerRank: RankItem[]
  heat: HeatCell[]
  warn: StockWarnItem[]
  flow: FlowItem[]
  updateTime: string
}

// ---------------- AI ----------------
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  /** 工具调用结果（自然语言查数据返回的结构化数据） */
  tool?: ToolResult
  /** 是否流式输出中 */
  streaming?: boolean
  createTime: number
  error?: string
}

export interface ToolResult {
  name: string
  /** 图表类型，供渲染引擎自动选图 */
  chart: 'table' | 'line' | 'bar' | 'pie'
  columns: { label: string; prop: string }[]
  rows: Record<string, unknown>[]
  summary: string
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createTime: number
  updateTime: number
}
