// 注意：这里导入的是封装后的 request（返回 data 部分），不是 axios 实例
import { request } from './request'
import type { PageResult, PageQuery, Goods, Supplier, Customer, Warehouse } from './types'

/** 基础数据：商品 / 供应商 / 客户 / 仓库 —— 共用同一套 CRUD 契约 */
const BASE = '/base'

export const goodsApi = {
  list: (params: PageQuery) => request<PageResult<Goods>>({ url: `${BASE}/goods/list`, params }),
  save: (data: Partial<Goods>) => request<number>({ url: `${BASE}/goods/save`, method: 'post', data }),
  remove: (id: number) => request<null>({ url: `${BASE}/goods/delete/${id}`, method: 'delete' }),
  all: () => request<Goods[]>({ url: `${BASE}/goods/all` })
}

export const supplierApi = {
  list: (params: PageQuery) => request<PageResult<Supplier>>({ url: `${BASE}/supplier/list`, params }),
  save: (data: Partial<Supplier>) => request<number>({ url: `${BASE}/supplier/save`, method: 'post', data }),
  remove: (id: number) => request<null>({ url: `${BASE}/supplier/delete/${id}`, method: 'delete' }),
  all: () => request<Supplier[]>({ url: `${BASE}/supplier/all` })
}

export const customerApi = {
  list: (params: PageQuery) => request<PageResult<Customer>>({ url: `${BASE}/customer/list`, params }),
  save: (data: Partial<Customer>) => request<number>({ url: `${BASE}/customer/save`, method: 'post', data }),
  remove: (id: number) => request<null>({ url: `${BASE}/customer/delete/${id}`, method: 'delete' }),
  all: () => request<Customer[]>({ url: `${BASE}/customer/all` })
}

export const warehouseApi = {
  list: (params: PageQuery) => request<PageResult<Warehouse>>({ url: `${BASE}/warehouse/list`, params }),
  save: (data: Partial<Warehouse>) => request<number>({ url: `${BASE}/warehouse/save`, method: 'post', data }),
  remove: (id: number) => request<null>({ url: `${BASE}/warehouse/delete/${id}`, method: 'delete' }),
  all: () => request<Warehouse[]>({ url: `${BASE}/warehouse/all` })
}
