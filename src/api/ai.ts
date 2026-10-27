/**
 * AI 模块接口
 * 设计要点：
 * 1. 对话走 SSE 流式，用 fetch + ReadableStream 手动解析（不用 EventSource，因为它不支持 POST）
 * 2. 模型接入在后端做抽象，前端只关心「流式文本 + 工具调用结果」两种事件
 * 3. 未配置 API Key 时后端自动降级为内置离线模拟模型，前端逻辑完全一致
 */
import { getToken } from '@/utils/auth'
import type { ToolResult } from './types'

const baseURL = (import.meta.env.VITE_API_BASE as string) || '/api'

export interface StreamHandlers {
  /** 收到一段文本增量 */
  onDelta: (text: string) => void
  /** 工具调用结果（自然语言查数据 / 智能填单） */
  onTool: (tool: ToolResult) => void
  /** 首字节到达，用于统计首 token 耗时 */
  onFirstByte?: () => void
  /** 正常结束 */
  onDone?: (full: string) => void
  /** 出错 */
  onError: (err: Error) => void
}

export interface ChatPayload {
  sessionId: string
  message: string
  /** 上下文消息（已做过摘要压缩） */
  history: { role: 'user' | 'assistant'; content: string }[]
  /** 业务场景：chat=通用问答，query=查数据，fill=智能填单，explain=报表解读 */
  scene: 'chat' | 'query' | 'fill' | 'explain'
  /** 附带的业务上下文，如点击的指标 key */
  context?: Record<string, unknown>
}

/**
 * SSE 流式对话
 * @returns AbortController，调用 abort() 即中断生成
 */
export function streamChat(payload: ChatPayload, handlers: StreamHandlers): AbortController {
  const controller = new AbortController()

  fetch(`${baseURL}/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`
    },
    body: JSON.stringify(payload),
    signal: controller.signal
  })
    .then(async (res) => {
      if (!res.ok || !res.body) throw new Error(`请求失败：${res.status}`)
      const reader = res.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      let full = ''
      let first = true

      // SSE 帧以 \n\n 分隔，逐块解析
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        let sepIdx: number
        while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, sepIdx)
          buffer = buffer.slice(sepIdx + 2)
          if (!frame.trim()) continue

          // 一个帧里可能有多行；只取 event/data
          let event = 'message'
          let data = ''
          for (const line of frame.split('\n')) {
            if (line.startsWith('event:')) event = line.slice(6).trim()
            else if (line.startsWith('data:')) data += line.slice(5).trim()
          }
          if (!data) continue

          if (first) {
            first = false
            handlers.onFirstByte?.()
          }
          try {
            const parsed = JSON.parse(data)
            if (event === 'delta' || parsed.type === 'delta') {
              full += parsed.text || ''
              handlers.onDelta(parsed.text || '')
            } else if (event === 'tool' || parsed.type === 'tool') {
              handlers.onTool(parsed.tool as ToolResult)
            } else if (event === 'done' || parsed.type === 'done') {
              handlers.onDone?.(full)
            } else if (event === 'error' || parsed.type === 'error') {
              handlers.onError(new Error(parsed.message || '生成失败'))
            }
          } catch {
            // 非 JSON 帧忽略，避免单帧脏数据中断整体流
          }
        }
      }
      handlers.onDone?.(full)
    })
    .catch((err: Error) => {
      if (err.name === 'AbortError') return
      handlers.onError(err)
    })

  return controller
}

/** 预警解读：一次性生成，不走流 */
export function explainWarning(warehouseId?: number) {
  return fetch(`${baseURL}/ai/explain-warn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ warehouseId })
  }).then((r) => r.json())
}
