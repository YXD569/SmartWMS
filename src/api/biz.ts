// 注意：这里导入的是封装后的 request（返回 data 部分），不是 axios 实例
import { request } from './request'
import type { PageResult, PageQuery, Bill, BillPayload, Inventory, StockWarnItem, FlowItem } from './types'

const BIZ = '/biz'
const STOCK = '/stock'

/** 单据：采购 / 销售 / 盘点共用一套接口，靠 bizType 区分 */
export const billApi = {
  /** bizType: PURCHASE | SALE | CHECK */
  list: (bizType: string, params: PageQuery) =>
    request<PageResult<Bill>>({ url: `${BIZ}/bill/list`, params: { bizType, ...params } }),
  detail: (id: number) => request<Bill>({ url: `${BIZ}/bill/detail/${id}` }),
  save: (data: BillPayload) => request<number>({ url: `${BIZ}/bill/save`, method: 'post', data }),
  remove: (id: number) => request<null>({ url: `${BIZ}/bill/delete/${id}`, method: 'delete' }),
  /**
   * 状态流转：由后端校验状态机合法性，前端只传目标状态
   * 这样做的原因是：状态规则必须服务端兜底，前端校验可被绕过
   */
  transfer: (id: number, target: string) =>
    request<null>({ url: `${BIZ}/bill/transfer`, method: 'post', data: { id, target } })
}

export const stockApi = {
  /** 分页查询库存台账 */
  list: (params: PageQuery) => request<PageResult<Inventory>>({ url: `${STOCK}/inventory/list`, params }),
  /** 全量拉取（虚拟滚动演示，默认 10 万行） */
  all: (size?: number) => request<Inventory[]>({ url: `${STOCK}/inventory/all`, params: { size }, timeout: 60000 }),
  /** 预警清单 */
  warn: () => request<StockWarnItem[]>({ url: `${STOCK}/warn` }),
  /** 出入库流水 */
  flow: (limit?: number) => request<FlowItem[]>({ url: `${STOCK}/flow`, params: { limit } })
}
