<script setup lang="ts">
/**
 * VirtualTable：自研虚拟滚动表格
 * ------------------------------------------------------------------
 * 为什么不直接用 el-table：10 万行场景下 el-table 会为每行创建完整 VNode 与
 * 组件实例，首屏渲染与滚动都会卡死。这里只渲染可视区 + 上下缓冲区的行，
 * 用 spacer 撑起总高度，滚动时只更新起始偏移，DOM 节点数恒定在 30 个左右。
 *
 * 可量化指标：10 万行滚动稳定 55fps 以上（见 README 性能章节）
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

export interface VColumn {
  label: string
  prop: string
  /** 列宽，支持数字(px)或 flex 权重字符串如 '2' */
  width?: number | string
  align?: 'left' | 'center' | 'right'
  formatter?: (row: any) => string
  slot?: boolean
}

const props = withDefaults(
  defineProps<{
    columns: VColumn[]
    rows: any[]
    /** 行高，必须固定，虚拟滚动的前提 */
    rowHeight?: number
    /** 视口高度 */
    height?: number
    /** 上下缓冲行数 */
    buffer?: number
  }>(),
  { rowHeight: 38, height: 520, buffer: 6 }
)

const scrollTop = ref(0)
const containerRef = ref<HTMLElement | null>(null)

/** 可视区起始索引 */
const startIndex = computed(() => {
  const s = Math.floor(scrollTop.value / props.rowHeight) - props.buffer
  return Math.max(0, s)
})

/** 可视区结束索引 */
const endIndex = computed(() => {
  const count = Math.ceil(props.height / props.rowHeight) + props.buffer * 2
  return Math.min(props.rows.length, startIndex.value + count)
})

/** 当前需要渲染的切片 */
const visibleRows = computed(() => props.rows.slice(startIndex.value, endIndex.value))

/** 撑起滚动条的总高度 */
const totalHeight = computed(() => props.rows.length * props.rowHeight)

/** 可视区整体偏移量 */
const offsetY = computed(() => startIndex.value * props.rowHeight)

/** 列宽解析：数字按 px，字符串按 flex 权重 */
function colStyle(col: VColumn) {
  if (typeof col.width === 'number') {
    return { width: `${col.width}px`, flex: `0 0 ${col.width}px` }
  }
  return { flex: `${col.width || '1'} 1 0` }
}

const gridTemplate = computed(() =>
  props.columns.map((c) => (typeof c.width === 'number' ? `${c.width}px` : `${c.width || 1}fr`)).join(' ')
)

function onScroll(e: Event) {
  const el = e.target as HTMLElement
  // 同值不触发更新，减少无意义重渲染
  if (Math.abs(el.scrollTop - scrollTop.value) < props.rowHeight / 2) return
  scrollTop.value = el.scrollTop
}

/** 对外暴露：滚动到顶部（刷新数据后用） */
function scrollToTop() {
  if (containerRef.value) containerRef.value.scrollTop = 0
  scrollTop.value = 0
}

defineExpose({ scrollToTop })

onMounted(() => {
  containerRef.value?.addEventListener('scroll', onScroll, { passive: true })
})
onBeforeUnmount(() => {
  containerRef.value?.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <div class="virtual-table">
    <!-- 表头 -->
    <div class="vt-header" :style="{ gridTemplateColumns: gridTemplate }">
      <div
        v-for="col in columns"
        :key="col.prop"
        class="vt-th"
        :style="{ textAlign: col.align || 'left' }"
      >
        {{ col.label }}
      </div>
    </div>

    <!-- 滚动视口 -->
    <div ref="containerRef" class="vt-body" :style="{ height: `${height}px` }">
      <div class="vt-spacer" :style="{ height: `${totalHeight}px` }">
        <div class="vt-viewport" :style="{ transform: `translateY(${offsetY}px)` }">
          <div
            v-for="(row, i) in visibleRows"
            :key="(row.id ?? startIndex + i)"
            class="vt-row"
            :style="{ gridTemplateColumns: gridTemplate, height: `${rowHeight}px` }"
          >
            <div
              v-for="col in columns"
              :key="col.prop"
              class="vt-td"
              :style="{ textAlign: col.align || 'left' }"
            >
              <slot v-if="col.slot" :name="col.prop" :row="row" />
              <span v-else-if="col.formatter">{{ col.formatter(row) }}</span>
              <span v-else>{{ row[col.prop] }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="vt-footer">
      <span>共 {{ rows.length.toLocaleString('zh-CN') }} 行</span>
      <span class="muted">虚拟滚动 · 当前渲染 {{ visibleRows.length }} 行 · 行高 {{ rowHeight }}px</span>
    </div>
  </div>
</template>

<style scoped>
.virtual-table {
  border: 1px solid var(--sw-border-2);
  border-radius: var(--sw-radius);
  overflow: hidden;
  background: #fff;
}
html.dark .virtual-table { background: #1d1e1f; }

.vt-header {
  display: grid;
  background: #f8f8f9;
  border-bottom: 1px solid var(--sw-border-2);
  font-weight: 500;
  font-size: 13px;
}
html.dark .vt-header { background: #262727; }
.vt-th { padding: 0 10px; line-height: 38px; height: 38px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.vt-body { overflow-y: auto; overflow-x: hidden; position: relative; }
.vt-spacer { position: relative; width: 100%; }
.vt-viewport { position: absolute; top: 0; left: 0; right: 0; will-change: transform; }

.vt-row {
  display: grid;
  align-items: center;
  border-bottom: 1px solid var(--sw-border-3);
  font-size: 13px;
}
.vt-row:hover { background: #f5f7fa; }
html.dark .vt-row:hover { background: #2a2b2c; }
.vt-td { padding: 0 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.vt-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 12px;
  font-size: 12px;
  color: var(--sw-text-3);
  border-top: 1px solid var(--sw-border-2);
  font-variant-numeric: tabular-nums;
}
.vt-footer .muted { color: var(--sw-text-4); }
</style>
