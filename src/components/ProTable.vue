<script setup lang="ts">
/**
 * ProTable：后台列表页通用表格
 * 在 el-table 之上补齐三件 ruoyi 后台必备但 Element 没给的能力：
 * 1. 列显隐 + 列顺序拖拽，配置按表名持久化到 localStorage
 * 2. 右侧工具栏（刷新 / 密度 / 列设置）
 * 3. 搜索区与表格区的统一卡片容器
 */
import { ref, computed, watch, onMounted } from 'vue'
import DictTag from './DictTag.vue'

export interface ProColumn {
  label: string
  prop: string
  width?: number | string
  minWidth?: number | string
  align?: 'left' | 'center' | 'right'
  fixed?: 'left' | 'right'
  /** 是否允许隐藏，默认 true；操作列一般设 false */
  hideable?: boolean
  /** 单元格格式化 */
  formatter?: (row: any) => string
  /** 是否启用 slot，slot 名为 prop */
  slot?: boolean
  /** 按字典渲染成标签，值取 DICT_MAP[dict] */
  dict?: string
  /** 标签是否带状态圆点 */
  dictDot?: boolean
  /** 表头对齐提示 */
  tooltip?: string
}

const props = withDefaults(
  defineProps<{
    columns: ProColumn[]
    data: any[]
    loading?: boolean
    /** 用于持久化列配置的唯一标识，一般传路由名 */
    name?: string
    selectable?: boolean
    showIndex?: boolean
    height?: string | number
  }>(),
  { loading: false, selectable: false, showIndex: true }
)

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'selection-change', rows: any[]): void
}>()

const STORE_PREFIX = 'smartwms_cols_'

/** 可见列（含顺序） */
const visibleProps = ref<string[]>([])
/** 密度：中等 / 紧凑 */
const density = ref<'default' | 'small'>('default')
const settingVisible = ref(false)

const storageKey = computed(() => `${STORE_PREFIX}${props.name || 'default'}`)

function loadConfig() {
  const raw = localStorage.getItem(storageKey.value)
  if (raw) {
    try {
      const saved: string[] = JSON.parse(raw)
      // 过滤掉已删除的列，并补上新列
      const valid = saved.filter((p) => props.columns.some((c) => c.prop === p))
      const missing = props.columns.filter((c) => !valid.includes(c.prop)).map((c) => c.prop)
      visibleProps.value = [...valid, ...missing]
      return
    } catch {
      // 解析失败走默认
    }
  }
  visibleProps.value = props.columns.map((c) => c.prop)
}

function saveConfig() {
  localStorage.setItem(storageKey.value, JSON.stringify(visibleProps.value))
}

watch(visibleProps, saveConfig, { deep: true })
watch(() => props.columns, loadConfig, { deep: true })
onMounted(loadConfig)

/** 渲染列：按 visibleProps 顺序排列 */
const renderColumns = computed(() =>
  visibleProps.value.map((p) => props.columns.find((c) => c.prop === p)).filter(Boolean) as ProColumn[]
)

function toggleColumn(prop: string) {
  const idx = visibleProps.value.indexOf(prop)
  if (idx > -1) visibleProps.value.splice(idx, 1)
  else visibleProps.value.push(prop)
}

/** 简易拖拽排序：HTML5 draggable，避免引入额外依赖 */
const dragProp = ref('')
function onDragStart(prop: string) {
  dragProp.value = prop
}
function onDrop(target: string) {
  if (!dragProp.value || dragProp.value === target) return
  const from = visibleProps.value.indexOf(dragProp.value)
  const to = visibleProps.value.indexOf(target)
  if (from === -1 || to === -1) return
  visibleProps.value.splice(from, 1)
  visibleProps.value.splice(to, 0, dragProp.value)
  dragProp.value = ''
}

function resetColumns() {
  visibleProps.value = props.columns.map((c) => c.prop)
}
</script>

<template>
  <div class="pro-table">
    <div class="table-toolbar">
      <div class="toolbar-left">
        <slot name="actions" />
      </div>
      <div class="toolbar-right">
        <el-tooltip content="刷新" placement="top">
          <el-icon class="toolbar-icon-btn" @click="emit('refresh')"><Refresh /></el-icon>
        </el-tooltip>
        <el-tooltip :content="density === 'default' ? '切换紧凑' : '切换宽松'" placement="top">
          <el-icon class="toolbar-icon-btn" @click="density = density === 'default' ? 'small' : 'default'">
            <component :is="density === 'default' ? 'Fold' : 'Expand'" />
          </el-icon>
        </el-tooltip>
        <el-popover v-model:visible="settingVisible" placement="bottom-end" :width="220" trigger="click">
          <template #reference>
            <el-icon class="toolbar-icon-btn"><Setting /></el-icon>
          </template>
          <div class="col-setting">
            <div class="head">
              <span>列设置</span>
              <el-button link type="primary" size="small" @click="resetColumns">重置</el-button>
            </div>
            <div class="list">
              <div
                v-for="col in columns"
                :key="col.prop"
                class="col-item"
                :draggable="true"
                @dragstart="onDragStart(col.prop)"
                @dragover.prevent
                @drop="onDrop(col.prop)"
              >
                <el-checkbox
                  :model-value="visibleProps.includes(col.prop)"
                  :disabled="col.hideable === false"
                  @change="toggleColumn(col.prop)"
                >
                  {{ col.label }}
                </el-checkbox>
                <el-icon class="drag"><Rank /></el-icon>
              </div>
            </div>
          </div>
        </el-popover>
      </div>
    </div>

    <el-table
      v-loading="loading"
      :data="data"
      :size="density"
      :height="height"
      border
      stripe
      @selection-change="(rows: any[]) => emit('selection-change', rows)"
    >
      <el-table-column v-if="selectable" type="selection" width="46" align="center" />
      <el-table-column v-if="showIndex" type="index" label="#" width="56" align="center" />

      <el-table-column
        v-for="col in renderColumns"
        :key="col.prop"
        :prop="col.prop"
        :label="col.label"
        :width="col.width"
        :min-width="col.minWidth"
        :align="col.align || 'left'"
        :fixed="col.fixed"
        show-overflow-tooltip
      >
        <template v-if="col.slot" #default="{ row }">
          <slot :name="col.prop" :row="row" />
        </template>
        <template v-else-if="col.dict" #default="{ row }">
          <DictTag :dict="col.dict" :value="row[col.prop]" :dot="col.dictDot" />
        </template>
        <template v-else-if="col.formatter" #default="{ row }">
          {{ col.formatter(row) }}
        </template>
      </el-table-column>

      <!-- 默认插槽：供调用方追加操作列等自定义列 -->
      <slot />
    </el-table>

    <div class="pagination-wrap">
      <slot name="pagination" />
    </div>
  </div>
</template>

<style scoped>
.col-setting .head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 500;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--sw-border-3);
  margin-bottom: 6px;
}
.col-setting .list { max-height: 320px; overflow: auto; }
.col-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 4px;
  cursor: move;
  border-radius: var(--sw-radius);
}
.col-item:hover { background: var(--sw-fill); }
.col-item .drag { color: var(--sw-text-4); font-size: 14px; }
</style>
