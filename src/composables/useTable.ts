import { ref, reactive, onMounted, type Ref } from 'vue'
import type { PageQuery, PageResult } from '@/api/types'

/**
 * 列表页通用逻辑：查询、分页、loading、刷新、多选
 * 把后台列表页重复的分页样板收敛到一处，页面只关注列与操作
 */
export interface TableOptions {
  /** 是否挂载后自动加载 */
  immediate?: boolean
  /** 默认页大小 */
  pageSize?: number
  /** 初始查询条件 */
  defaultQuery?: Record<string, unknown>
}

export function useTable<T = any>(
  fetcher: (params: PageQuery) => Promise<PageResult<T>>,
  options: TableOptions = {}
) {
  const { immediate = true, pageSize = 20, defaultQuery = {} } = options

  const list = ref<T[]>([]) as Ref<T[]>
  const total = ref(0)
  const loading = ref(false)
  const selection = ref<T[]>([]) as Ref<T[]>

  const query = reactive<PageQuery>({ page: 1, pageSize, ...defaultQuery })

  async function load() {
    loading.value = true
    try {
      const res = await fetcher({ ...query })
      list.value = res.list || []
      total.value = res.total || 0
    } catch {
      list.value = []
      total.value = 0
    } finally {
      loading.value = false
    }
  }

  /** 搜索：回到第一页 */
  function search() {
    query.page = 1
    return load()
  }

  /** 重置条件（保留分页大小） */
  function reset(extra: Record<string, unknown> = {}) {
    Object.keys(query).forEach((k) => {
      if (k !== 'pageSize') delete query[k]
    })
    Object.assign(query, { page: 1, pageSize }, extra)
    return load()
  }

  function handleSelectionChange(rows: T[]) {
    selection.value = rows
  }

  function handleSizeChange(size: number) {
    query.pageSize = size
    query.page = 1
    load()
  }

  function handleCurrentChange(page: number) {
    query.page = page
    load()
  }

  onMounted(() => {
    if (immediate) load()
  })

  return {
    list,
    total,
    loading,
    query,
    selection,
    load,
    search,
    reset,
    handleSelectionChange,
    handleSizeChange,
    handleCurrentChange
  }
}
