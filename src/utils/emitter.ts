/**
 * 极简事件总线
 * 只用于一处：AI 助手生成「智能填单」结果后回填到单据编辑弹窗。
 * 这种跨层级、非父子的一次性通信，用 store 会污染全局状态，用总线更轻。
 */
type Handler = (payload: any) => void

const handlers = new Map<string, Handler[]>()

export const emitter = {
  on(key: string, handler: Handler) {
    const list = handlers.get(key) || []
    list.push(handler)
    handlers.set(key, list)
  },
  off(key: string, handler: Handler) {
    const list = handlers.get(key)
    if (!list) return
    handlers.set(key, list.filter((h) => h !== handler))
  },
  emit(key: string, payload?: any) {
    ;(handlers.get(key) || []).forEach((h) => h(payload))
  }
}

/** AI 填单结果事件名 */
export const AI_FILL_RESULT = 'ai:fill-result'
