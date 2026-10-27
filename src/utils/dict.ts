/**
 * 数据字典
 * 后台所有枚举统一在此维护，表格/表单/标签共用同一份口径，避免各处硬编码
 */

export interface DictItem {
  label: string
  value: string | number
  /** 标签类型，用于 el-tag */
  type?: 'primary' | 'success' | 'info' | 'warning' | 'danger'
}

/** 单据状态：状态机驱动，见 docs 中的状态流转说明 */
export const BILL_STATUS: DictItem[] = [
  { label: '草稿', value: 'DRAFT', type: 'info' },
  { label: '待审核', value: 'PENDING', type: 'warning' },
  { label: '已审核', value: 'APPROVED', type: 'primary' },
  { label: '执行中', value: 'RUNNING', type: 'primary' },
  { label: '已完成', value: 'FINISHED', type: 'success' },
  { label: '已作废', value: 'CANCELED', type: 'danger' }
]

/** 单据状态允许的流转（状态机核心：只在此声明，页面与后端共用同一份规则） */
export const STATUS_FLOW: Record<string, string[]> = {
  DRAFT: ['PENDING', 'CANCELED'],
  PENDING: ['APPROVED', 'DRAFT', 'CANCELED'],
  APPROVED: ['RUNNING', 'CANCELED'],
  RUNNING: ['FINISHED', 'CANCELED'],
  FINISHED: [],
  CANCELED: ['DRAFT']
}

/** 出入库类型 */
export const IO_TYPE: DictItem[] = [
  { label: '采购入库', value: 'PURCHASE_IN', type: 'success' },
  { label: '销售出库', value: 'SALE_OUT', type: 'warning' },
  { label: '退货入库', value: 'RETURN_IN', type: 'success' },
  { label: '退货出库', value: 'RETURN_OUT', type: 'warning' },
  { label: '盘盈入库', value: 'PROFIT_IN', type: 'success' },
  { label: '盘亏出库', value: 'LOSS_OUT', type: 'danger' },
  { label: '库位调拨', value: 'TRANSFER', type: 'info' }
]

/** 预警级别 */
export const WARN_LEVEL: DictItem[] = [
  { label: '严重', value: 'HIGH', type: 'danger' },
  { label: '警告', value: 'MIDDLE', type: 'warning' },
  { label: '关注', value: 'LOW', type: 'info' }
]

/** 商品类别 */
export const GOODS_CATEGORY: DictItem[] = [
  { label: '原材料', value: 'RAW' },
  { label: '半成品', value: 'SEMI' },
  { label: '成品', value: 'FINISHED' },
  { label: '包装物', value: 'PACKAGE' },
  { label: '耗材', value: 'CONSUMABLE' }
]

/** 仓库类型 */
export const WAREHOUSE_TYPE: DictItem[] = [
  { label: '中心仓', value: 'CENTER' },
  { label: '区域仓', value: 'REGION' },
  { label: '前置仓', value: 'FRONT' },
  { label: '暂存仓', value: 'TEMP' }
]

/** 计量单位 */
export const UNIT: DictItem[] = [
  { label: '件', value: '件' },
  { label: '箱', value: '箱' },
  { label: '千克', value: 'kg' },
  { label: '米', value: 'm' },
  { label: '台', value: '台' }
]

/** 字典注册表：DictTag / 表格列 通过 key 取值 */
export const DICT_MAP: Record<string, DictItem[]> = {
  bill_status: BILL_STATUS,
  io_type: IO_TYPE,
  warn_level: WARN_LEVEL,
  goods_category: GOODS_CATEGORY,
  warehouse_type: WAREHOUSE_TYPE,
  unit: UNIT
}

export function dictLabel(key: string, value: string | number): string {
  const list = DICT_MAP[key]
  if (!list) return String(value ?? '')
  const hit = list.find((i) => String(i.value) === String(value))
  return hit ? hit.label : String(value ?? '')
}

export function dictType(key: string, value: string | number): string {
  const list = DICT_MAP[key]
  if (!list) return 'info'
  const hit = list.find((i) => String(i.value) === String(value))
  return hit?.type || 'info'
}

/** 状态机：判断 from 是否可流转到 to */
export function canTransfer(from: string, to: string): boolean {
  return (STATUS_FLOW[from] || []).includes(to)
}

/** 状态机：某状态下可执行的操作 */
export function allowedActions(status: string): string[] {
  return STATUS_FLOW[status] || []
}

/** 动作中文名 */
export const ACTION_LABEL: Record<string, string> = {
  PENDING: '提交审核',
  APPROVED: '审核通过',
  RUNNING: '开始执行',
  FINISHED: '完成',
  CANCELED: '作废',
  DRAFT: '退回草稿'
}
