<script setup lang="ts">
/**
 * AI 智能模块
 * ------------------------------------------------------------------
 * 内嵌在中后台右侧的常驻助手，复用登录态与业务接口，不是独立的聊天 Demo。
 *
 * 覆盖的能力点：
 * 1. SSE 流式输出（fetch + ReadableStream 手解，支持 POST 传上下文）
 * 2. 中断生成 / 重新生成 / 失败重试（AbortController）
 * 3. Markdown 渲染（含代码高亮、表格、链接）
 * 4. 多会话管理，本地持久化，支持新建 / 切换 / 删除
 * 5. 上下文窗口管理：超轮次摘要压缩 + token 粗估
 * 6. 自然语言查数据：模型输出结构化查询条件，前端自动渲染表格并选图
 * 7. 智能填单：识别文本为明细行，通过事件总线回填到单据编辑弹窗
 * 8. 报表解读：携带指标上下文追问同比环比异动原因
 * 9. 容错与成本：首 token 耗时展示、超时降级提示、结果缓存、手机号脱敏
 */
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'

import { streamChat } from '@/api/ai'
import { useAppStore } from '@/stores/app'
import { emitter, AI_FILL_RESULT } from '@/utils/emitter'
import { maskPhone } from '@/utils/format'
import ChartRenderer, { type ChartConfig } from './ChartRenderer.vue'
import type { ChatMessage, ChatSession, ToolResult } from '@/api/types'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('bash', bash)

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  highlight(code: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      return `<pre class="hljs"><code>${hljs.highlight(code, { language: lang }).value}</code></pre>`
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(code)}</code></pre>`
  }
})

const appStore = useAppStore()

// ---------------- 会话 ----------------
const STORE_KEY = 'smartwms_ai_sessions'
const sessions = ref<ChatSession[]>([])
const activeId = ref('')

function createSession(title = '新会话'): ChatSession {
  return {
    id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title,
    messages: [],
    createTime: Date.now(),
    updateTime: Date.now()
  }
}

function loadSessions() {
  const raw = localStorage.getItem(STORE_KEY)
  if (raw) {
    try {
      sessions.value = JSON.parse(raw)
      if (sessions.value.length) activeId.value = sessions.value[0].id
      return
    } catch {
      // 数据损坏则重建
    }
  }
  const s = createSession()
  sessions.value = [s]
  activeId.value = s.id
}

function persist() {
  // 只保留最近 20 个会话，避免 localStorage 膨胀
  localStorage.setItem(STORE_KEY, JSON.stringify(sessions.value.slice(0, 20)))
}

const currentSession = computed(() => sessions.value.find((s) => s.id === activeId.value) || null)
const messages = computed(() => currentSession.value?.messages || [])

function newSession() {
  const s = createSession()
  sessions.value.unshift(s)
  activeId.value = s.id
  persist()
}

function removeSession(id: string) {
  sessions.value = sessions.value.filter((s) => s.id !== id)
  if (activeId.value === id) activeId.value = sessions.value[0]?.id || ''
  persist()
}

// ---------------- 输入与流式 ----------------
const input = ref('')
const streaming = ref(false)
const firstTokenMs = ref<number | null>(null)
const errorMsg = ref('')
let controller: AbortController | null = null
let startedAt = 0

/** 结果缓存：相同问题直接复用，降低重复调用成本 */
const cache = new Map<string, string>()

const SCENES = [
  { key: 'chat', label: '智能问答', icon: 'ChatDotRound' },
  { key: 'query', label: '查数据', icon: 'Search' },
  { key: 'fill', label: '智能填单', icon: 'EditPen' },
  { key: 'explain', label: '报表解读', icon: 'DataAnalysis' }
] as const

const scene = computed(() => appStore.aiScene)

/** 是否配置了真实模型 Key：模板里不能直接用 import.meta，故在此取值 */
const modelOnline = !!import.meta.env.VITE_AI_API_KEY

const QUICK_QUESTIONS: Record<string, string[]> = {
  chat: ['当前库存管理有哪些风险点？', '如何降低呆滞库存占比？', '解释一下安全库存的设置逻辑'],
  query: ['上个月哪个仓库出库量最高？', '各品类库存占比是多少？', '近 30 天出入库趋势如何？'],
  fill: ['采购 螺帽M8 200个，不锈钢板 50张', '出库 铝合金型材 120根，纸箱 300个'],
  explain: ['为什么本月履约率下降了？', '库存周转率变化的原因是什么？']
}

/** 上下文压缩：超出窗口的历史折叠为一段摘要，控制 token 消耗 */
const MAX_TURNS = 10
function buildHistory(list: ChatMessage[]) {
  const valid = list.filter((m) => !m.error && m.content)
  const recent = valid.slice(-MAX_TURNS)
  const older = valid.slice(0, -MAX_TURNS)
  const history: { role: 'user' | 'assistant'; content: string }[] = []
  if (older.length) {
    const summary = older
      .map((m) => `${m.role === 'user' ? '用户' : '助手'}：${m.content.slice(0, 60)}`)
      .join('；')
    history.push({ role: 'user', content: `[历史对话摘要] ${summary}` })
  }
  recent.forEach((m) => {
    if (m.role !== 'system') history.push({ role: m.role, content: m.content.slice(0, 800) })
  })
  return history
}

/** token 粗估：中文按 1 字≈1 token，英文按 4 字符≈1 token */
function estimateTokens(list: ChatMessage[]): number {
  let total = 0
  buildHistory(list).forEach((m) => {
    const zh = (m.content.match(/[\u4e00-\u9fa5]/g) || []).length
    const en = m.content.replace(/[\u4e00-\u9fa5]/g, '').length
    total += zh + Math.ceil(en / 4)
  })
  return total
}

const contextTokens = computed(() => estimateTokens(messages.value))

function pushMessage(msg: ChatMessage) {
  const s = currentSession.value
  if (!s) return
  s.messages.push(msg)
  s.updateTime = Date.now()
  // 首条用户消息作为会话标题
  if (msg.role === 'user' && s.messages.filter((m) => m.role === 'user').length === 1) {
    s.title = msg.content.slice(0, 12)
  }
  persist()
  scrollToBottom()
}

function scrollToBottom() {
  nextTick(() => {
    const el = document.getElementById('ai-msg-list')
    if (el) el.scrollTop = el.scrollHeight
  })
}

async function send(text: string) {
  const content = text.trim()
  if (!content || streaming.value) return

  // 命中缓存直接复用
  const cacheKey = `${scene.value}:${content}`
  if (cache.has(cacheKey)) {
    pushMessage({ id: uid(), role: 'user', content, createTime: Date.now() })
    pushMessage({ id: uid(), role: 'assistant', content: cache.get(cacheKey)!, createTime: Date.now() })
    input.value = ''
    return
  }

  input.value = ''
  errorMsg.value = ''
  firstTokenMs.value = null
  startedAt = performance.now()

  pushMessage({ id: uid(), role: 'user', content, createTime: Date.now() })
  const replyId = uid()
  pushMessage({ id: replyId, role: 'assistant', content: '', streaming: true, createTime: Date.now() })

  streaming.value = true
  const target = () => messages.value.find((m) => m.id === replyId)!

  controller = streamChat(
    {
      sessionId: activeId.value,
      message: content,
      history: buildHistory(messages.value.slice(0, -1)),
      scene: scene.value as any
    },
    {
      onFirstByte: () => {
        firstTokenMs.value = Math.round(performance.now() - startedAt)
      },
      onDelta: (t) => {
        target().content += t
        scrollToBottom()
      },
      onTool: (tool: ToolResult) => {
        target().tool = tool
        // 智能填单：把识别结果回填到当前打开的单据编辑弹窗
        if (tool.name === 'fill_bill') {
          emitter.emit(AI_FILL_RESULT, { items: tool.rows })
        }
        scrollToBottom()
      },
      onDone: () => {
        const m = target()
        m.streaming = false
        streaming.value = false
        controller = null
        if (m.content) cache.set(cacheKey, m.content)
        persist()
      },
      onError: (e) => {
        const m = target()
        m.streaming = false
        m.error = e.message
        if (!m.content) m.content = '生成失败，请检查网络或稍后重试。'
        streaming.value = false
        controller = null
        errorMsg.value = e.message
      }
    }
  )

  // 超时降级：60 秒无结果主动中断，避免一直转圈
  window.setTimeout(() => {
    if (streaming.value && !firstTokenMs.value) {
      controller?.abort()
      streaming.value = false
      target().streaming = false
      target().error = '响应超时'
      if (!target().content) target().content = '模型响应超时，已中断。可稍后重试或切换模型。'
    }
  }, 60000)
}

function stop() {
  controller?.abort()
  controller = null
  streaming.value = false
  const last = [...messages.value].reverse().find((m) => m.role === 'assistant')
  if (last) {
    last.streaming = false
    if (last.content.trim()) last.content += '\n\n_[已停止生成]_'
  }
  persist()
}

function regenerate() {
  const list = messages.value.filter((m) => !m.error)
  const lastUser = [...list].reverse().find((m) => m.role === 'user')
  if (!lastUser) return
  // 删除上一条助手回复后重发
  const s = currentSession.value
  if (s) {
    const idx = s.messages.map((m) => m.id).lastIndexOf(lastUser.id)
    s.messages.splice(idx + 1)
    persist()
  }
  cache.delete(`${scene.value}:${lastUser.content}`)
  send(lastUser.content)
}

function uid(): string {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function renderMd(text: string): string {
  // 输出前脱敏：手机号打码，避免业务数据泄漏到展示层
  const safe = text.replace(/(1[3-9]\d)\d{4}(\d{4})/g, (_m, a, b) => `${a}****${b}`)
  return md.render(safe)
}

function useQuick(q: string) {
  input.value = q
  send(q)
}

/** 工具结果转图表配置：实现「AI 查数 → 自动出图」 */
function toolChartConfig(tool: ToolResult): ChartConfig | null {
  if (!tool || tool.chart === 'table' || !tool.rows?.length) return null
  const first = tool.columns[0]?.prop
  const valueProps = tool.columns.slice(1).map((c) => c.prop)
  if (!first || !valueProps.length) return null
  return {
    type: tool.chart === 'line' ? 'line' : tool.chart === 'bar' ? 'bar' : 'pie',
    rows: tool.rows,
    xField: first,
    yFields: valueProps,
    names: tool.columns.slice(1).map((c) => c.label),
    theme: 'light'
  }
}

/** 填单结果直接以表格式呈现，供用户核对 */
function isFillResult(tool: ToolResult) {
  return tool?.name === 'fill_bill'
}

const drawerVisible = computed({
  get: () => appStore.aiPanelVisible,
  set: (v) => appStore.toggleAiPanel(v)
})

onMounted(() => {
  loadSessions()
  // 大屏点击指标卡时携带上下文追问：预填问题并切到解读场景
  emitter.on('ai:explain-context', (p: { key: string; label: string }) => {
    appStore.openAi('explain')
    input.value = `请解读「${p.label}」这个指标的同比环比异动，说明可能原因与应对建议`
  })
})

// 场景切换时给一句引导，避免用户不知道当前模式能干什么
const sceneHint: Record<string, string> = {
  chat: '可以问业务流程、库存策略、系统用法等通用问题',
  query: '用自然语言查询库存、出入库、供应商等业务数据，结果会自动出表出图',
  fill: '粘贴一段采购/出库文本，AI 识别为明细行并回填到单据',
  explain: '针对大屏指标追问异动原因，可携带指标上下文'
}

watch(
  () => appStore.aiPanelVisible,
  (v) => {
    if (v && !sessions.value.length) loadSessions()
    if (v) scrollToBottom()
  }
)
</script>

<template>
  <el-drawer
    v-model="drawerVisible"
    :size="480"
    :with-header="false"
    direction="rtl"
    class="ai-drawer"
    :modal="true"
  >
    <div class="ai-panel">
      <!-- 头部 -->
      <div class="ai-head">
        <div class="title">
          <el-icon><MagicStick /></el-icon>
          <span>AI 助手</span>
          <el-tag size="small" type="info" effect="plain">
            {{ modelOnline ? '在线模型' : '离线模拟' }}
          </el-tag>
        </div>
        <div class="ops">
          <el-tooltip content="新建会话" placement="bottom">
            <el-icon class="op" @click="newSession"><Plus /></el-icon>
          </el-tooltip>
          <el-icon class="op" @click="appStore.toggleAiPanel(false)"><Close /></el-icon>
        </div>
      </div>

      <!-- 场景切换 -->
      <div class="ai-scenes">
        <button
          v-for="s in SCENES"
          :key="s.key"
          class="scene"
          :class="{ on: scene === s.key }"
          @click="appStore.openAi(s.key as any)"
        >
          <el-icon><component :is="s.icon" /></el-icon>
          <span>{{ s.label }}</span>
        </button>
      </div>
      <div class="scene-hint">{{ sceneHint[scene] }}</div>

      <!-- 会话列表 -->
      <div v-if="sessions.length > 1" class="ai-sessions">
        <span
          v-for="s in sessions"
          :key="s.id"
          class="sess"
          :class="{ on: s.id === activeId }"
          @click="activeId = s.id"
        >
          {{ s.title }}
          <el-icon class="del" @click.stop="removeSession(s.id)"><Close /></el-icon>
        </span>
      </div>

      <!-- 消息区 -->
      <div id="ai-msg-list" class="ai-messages">
        <div v-if="!messages.length" class="empty">
          <el-icon class="e-icon"><ChatDotRound /></el-icon>
          <p>还没有对话，试试下面的快捷问题</p>
        </div>

        <div v-for="m in messages" :key="m.id" class="msg" :class="m.role">
          <div class="avatar">
            <el-icon v-if="m.role === 'user'"><User /></el-icon>
            <el-icon v-else><MagicStick /></el-icon>
          </div>
          <div class="bubble">
            <div v-if="m.role === 'user'" class="text">{{ m.content }}</div>
            <div v-else>
              <div v-if="m.content" class="md-body" v-html="renderMd(m.content)"></div>
              <span v-if="m.streaming" class="caret"></span>

              <!-- 工具结果：表格 + 自动图表 -->
              <div v-if="m.tool" class="tool-card">
                <div class="tool-head">
                  <el-icon><DataAnalysis /></el-icon>
                  <span>{{ m.tool.summary || '查询结果' }}</span>
                </div>
                <el-table :data="m.tool.rows" size="small" border max-height="220">
                  <el-table-column
                    v-for="c in m.tool.columns"
                    :key="c.prop"
                    :prop="c.prop"
                    :label="c.label"
                    show-overflow-tooltip
                  />
                </el-table>
                <ChartRenderer
                  v-if="toolChartConfig(m.tool)"
                  :config="toolChartConfig(m.tool)!"
                  :height="180"
                  style="margin-top: 8px"
                />
                <div v-if="isFillResult(m.tool)" class="fill-tip">
                  已回填到当前打开的单据编辑弹窗，请核对数量后保存
                </div>
              </div>

              <div v-if="m.error" class="err">
                <el-icon><WarningFilled /></el-icon> {{ m.error }}
                <el-button link type="primary" size="small" @click="regenerate">重试</el-button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 快捷问题 -->
      <div class="ai-quick">
        <span v-for="q in QUICK_QUESTIONS[scene] || []" :key="q" class="q" @click="useQuick(q)">{{ q }}</span>
      </div>

      <!-- 输入区 -->
      <div class="ai-input">
        <el-input
          v-model="input"
          type="textarea"
          :rows="3"
          resize="none"
          :placeholder="`输入内容，Enter 发送，Shift+Enter 换行`"
          @keydown.enter.exact.prevent="send(input)"
        />
        <div class="bar">
          <div class="meta">
            <span v-if="firstTokenMs !== null">首字 {{ firstTokenMs }} ms</span>
            <span>上下文 ≈ {{ contextTokens }} tokens</span>
          </div>
          <div class="btns">
            <el-button v-if="streaming" size="small" icon="VideoPause" @click="stop">停止</el-button>
            <el-button
              v-else
              size="small"
              type="primary"
              :disabled="!input.trim()"
              @click="send(input)"
            >
              发送
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<style scoped>
.ai-panel { display: flex; flex-direction: column; height: 100%; }

.ai-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px; border-bottom: 1px solid var(--sw-border-3);
}
.ai-head .title { display: flex; align-items: center; gap: 7px; font-size: 15px; font-weight: 600; }
.ai-head .title .el-icon { color: var(--sw-primary); }
.ai-head .ops { display: flex; gap: 6px; }
.ai-head .op { font-size: 16px; cursor: pointer; color: var(--sw-text-3); padding: 4px; border-radius: 3px; }
.ai-head .op:hover { background: var(--sw-fill); color: var(--sw-primary); }

.ai-scenes { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; padding: 10px 14px 4px; }
.scene {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 7px 4px; font-size: 12px; cursor: pointer;
  border: 1px solid var(--sw-border-2); border-radius: var(--sw-radius);
  background: transparent; color: var(--sw-text-2);
  transition: all var(--sw-dur-fast);
}
.scene:hover { border-color: var(--sw-primary); color: var(--sw-primary); }
.scene.on { background: var(--sw-primary); border-color: var(--sw-primary); color: #fff; }
.scene .el-icon { font-size: 15px; }
.scene-hint { padding: 4px 14px 8px; font-size: 12px; color: var(--sw-text-3); }

.ai-sessions { display: flex; gap: 6px; padding: 0 14px 8px; overflow-x: auto; }
.sess {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 9px; font-size: 12px; white-space: nowrap;
  border: 1px solid var(--sw-border-2); border-radius: 12px; cursor: pointer; color: var(--sw-text-2);
}
.sess.on { background: var(--sw-primary-light); border-color: var(--sw-primary); color: var(--sw-primary); }
.sess .del { font-size: 11px; }

.ai-messages { flex: 1; overflow-y: auto; padding: 12px 14px; background: var(--sw-fill); min-height: 0; }
html.dark .ai-messages { background: #1a1a1b; }
.empty { text-align: center; color: var(--sw-text-4); padding: 50px 0; }
.empty .e-icon { font-size: 34px; }
.empty p { margin: 8px 0 0; font-size: 13px; }

.msg { display: flex; gap: 8px; margin-bottom: 14px; }
.msg.user { flex-direction: row-reverse; }
.msg .avatar {
  width: 28px; height: 28px; flex: 0 0 auto; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--sw-primary); color: #fff; font-size: 14px;
}
.msg.user .avatar { background: #67c23a; }
.msg .bubble { max-width: calc(100% - 44px); }
.msg.user .bubble .text {
  background: var(--sw-primary); color: #fff;
  padding: 8px 12px; border-radius: 8px 2px 8px 8px; font-size: 13px; line-height: 1.7;
  white-space: pre-wrap; word-break: break-word;
}
.msg.assistant .bubble > div > .md-body {
  background: #fff; padding: 10px 12px; border-radius: 2px 8px 8px 8px;
  font-size: 13px; line-height: 1.75; border: 1px solid var(--sw-border-3);
}
html.dark .msg.assistant .bubble > div > .md-body { background: #262727; border-color: var(--sw-border-2); }

.caret {
  display: inline-block; width: 6px; height: 14px; background: var(--sw-primary);
  vertical-align: text-bottom; animation: blink 1s steps(2, start) infinite;
}
@keyframes blink { 50% { opacity: 0; } }

.tool-card {
  margin-top: 8px; border: 1px solid var(--sw-border-2); border-radius: var(--sw-radius);
  padding: 8px; background: #fff;
}
html.dark .tool-card { background: #262727; }
.tool-head { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--sw-primary); margin-bottom: 6px; }
.fill-tip { margin-top: 6px; font-size: 12px; color: var(--sw-success); }

.err { margin-top: 6px; font-size: 12px; color: var(--sw-danger); display: flex; align-items: center; gap: 4px; }

.ai-quick { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 14px; border-top: 1px solid var(--sw-border-3); }
.q {
  font-size: 12px; padding: 3px 9px; border-radius: 12px; cursor: pointer;
  background: var(--sw-fill); color: var(--sw-text-2);
}
.q:hover { background: var(--sw-primary-light); color: var(--sw-primary); }

.ai-input { padding: 10px 14px 12px; border-top: 1px solid var(--sw-border-3); }
.ai-input .bar { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; }
.ai-input .meta { font-size: 11.5px; color: var(--sw-text-4); display: flex; gap: 12px; font-variant-numeric: tabular-nums; }

/* Markdown 正文排版 */
:deep(.md-body) { word-break: break-word; }
:deep(.md-body p) { margin: 0 0 8px; }
:deep(.md-body p:last-child) { margin-bottom: 0; }
:deep(.md-body ul), :deep(.md-body ol) { margin: 0 0 8px; padding-left: 20px; }
:deep(.md-body li) { margin-bottom: 3px; }
:deep(.md-body table) { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 12.5px; }
:deep(.md-body th), :deep(.md-body td) { border: 1px solid var(--sw-border-2); padding: 5px 8px; text-align: left; }
:deep(.md-body th) { background: var(--sw-fill); }
:deep(.md-body code) { background: var(--sw-fill); padding: 1px 4px; border-radius: 3px; font-size: 12px; }
:deep(.md-body pre.hljs) {
  background: #1f2430; color: #e6e6e6; padding: 10px 12px; border-radius: 4px;
  overflow-x: auto; margin: 8px 0; font-size: 12px; line-height: 1.6;
}
:deep(.md-body blockquote) {
  margin: 8px 0; padding: 4px 10px; border-left: 3px solid var(--sw-primary);
  background: var(--sw-fill); color: var(--sw-text-2);
}
:deep(.md-body a) { color: var(--sw-primary); }
:deep(.md-body h3), :deep(.md-body h4) { margin: 10px 0 6px; font-size: 14px; }
</style>
