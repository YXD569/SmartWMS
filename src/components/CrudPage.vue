<script setup lang="ts">
/**
 * CrudPage：基础数据类页面的通用实现
 * 商品 / 供应商 / 客户 / 仓库 / 用户等页面结构完全一致（搜索 + 表格 + 弹窗表单 + 导入导出），
 * 把差异收敛成 columns / fields / api 三份配置，避免复制粘贴出五份几乎一样的代码。
 */
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus'
import type { ProColumn } from './ProTable.vue'
import ProTable from './ProTable.vue'
import { useTable } from '@/composables/useTable'
import { useFormModal } from '@/composables/useFormModal'
import { usePermission } from '@/composables/usePermission'
import { exportExcel, importExcel, downloadTemplate, type ExcelColumn } from '@/utils/excel'
import { DICT_MAP } from '@/utils/dict'

export interface FormField {
  label: string
  prop: string
  type: 'input' | 'number' | 'select' | 'textarea' | 'switch'
  dict?: string
  required?: boolean
  placeholder?: string
  /** 栅格占比，默认 12（一半宽） */
  span?: number
  default?: unknown
}

const props = defineProps<{
  name: string
  /** 列表/保存/删除三件套 */
  api: { list: (p: any) => Promise<any>; save: (d: any) => Promise<any>; remove: (id: number) => Promise<any> }
  columns: ProColumn[]
  fields: FormField[]
  /** 参与搜索的字段（取自 fields 的 prop） */
  searchProps?: string[]
}>()

const { hasPerm } = usePermission()

const { list, total, loading, query, selection, search, reset, handleSelectionChange, handleSizeChange, handleCurrentChange } =
  useTable(props.api.list, { defaultQuery: {} })

const { visible, submitting, isEdit, current, open, close, submit } = useFormModal()

const formRef = ref<FormInstance>()
const formData = ref<Record<string, unknown>>({})

/** 搜索表单：只渲染 searchProps 指定的字段 */
const searchModel = ref<Record<string, unknown>>({})
const searchFields = computed(() =>
  (props.searchProps || []).map((p) => props.fields.find((f) => f.prop === p)).filter(Boolean) as FormField[]
)

function openCreate() {
  formData.value = {}
  props.fields.forEach((f) => {
    if (f.default !== undefined) formData.value[f.prop] = f.default
  })
  open()
}

function openEdit(row: any) {
  formData.value = { ...row }
  open(row)
}

async function onSave() {
  await submit(
    async (row) => {
      await props.api.save({ ...(row || {}), ...formData.value })
      ElMessage.success('保存成功')
    },
    () => search()
  )
}

async function onDelete(row: any) {
  await ElMessageBox.confirm(`确定删除「${row.name || row.title || row.id}」吗？`, '提示', { type: 'warning' })
  await props.api.remove(row.id)
  ElMessage.success('删除成功')
  search()
}

async function onBatchDelete() {
  if (!selection.value.length) {
    ElMessage.warning('请先选择要删除的数据')
    return
  }
  await ElMessageBox.confirm(`确定删除选中的 ${selection.value.length} 条数据吗？`, '提示', { type: 'warning' })
  for (const row of selection.value) {
    await props.api.remove((row as any).id)
  }
  ElMessage.success('批量删除成功')
  search()
}

// ---------------- Excel ----------------
const excelColumns = computed<ExcelColumn[]>(() =>
  props.columns
    .filter((c) => c.prop !== 'operation')
    .map((c) => ({ label: c.label, prop: c.prop, width: 18 }))
)

/** 导出上限：服务端单页最大 200000，这里取 10000 兼顾体积与等待时间 */
const EXPORT_MAX = 10000
const exporting = ref(false)

/**
 * 导出全部命中数据，而不是只导当前页。
 * 旧实现直接拿 list.value（当前页 20 条），用户以为导出的是查询结果全集
 */
async function onExport() {
  if (!list.value.length) {
    ElMessage.warning('当前没有可导出的数据')
    return
  }
  exporting.value = true
  try {
    // 带当前查询条件重新拉一页大容量的数据
    const res = await props.api.list({ ...query, page: 1, pageSize: EXPORT_MAX })
    const rows = (res?.list?.length ? res.list : list.value) as unknown as Record<string, unknown>[]
    exportExcel(rows, excelColumns.value, props.name)
    if (rows.length > list.value.length) {
      ElMessage.success(`已导出全部 ${rows.length} 条（当前页仅 ${list.value.length} 条）`)
    }
  } catch (e: any) {
    // 全量拉取失败时降级为导出当前页，保证功能不中断
    exportExcel(list.value as unknown as Record<string, unknown>[], excelColumns.value, props.name)
    ElMessage.warning('全量导出失败，已导出当前页：' + (e.message || ''))
  } finally {
    exporting.value = false
  }
}

/** 导入：错误行不入库并弹窗展示明细 */
const importErrors = ref<{ row: number; label: string; value: unknown; message: string }[]>([])
const importVisible = ref(false)

async function beforeUpload(file: File) {
  const importCols: ExcelColumn[] = props.fields.map((f) => ({
    label: f.label,
    prop: f.prop,
    required: f.required,
    width: 18
  }))
  try {
    const result = await importExcel(file, importCols)
    for (const row of result.rows) {
      await props.api.save(row)
    }
    if (result.errors.length) {
      importErrors.value = result.errors
      importVisible.value = true
    }
    ElMessage.success(`导入完成：成功 ${result.rows.length} 行，失败 ${result.errors.length} 行`)
    search()
  } catch (e: any) {
    ElMessage.error('导入失败：' + (e.message || '文件格式不正确'))
  }
  // 阻止 el-upload 默认提交
  return false
}

function onDownloadTemplate() {
  downloadTemplate(props.fields.map((f) => ({ label: f.label, prop: f.prop, width: 18 })), `${props.name}导入模板`)
}

function dictOptions(dict?: string) {
  return dict ? DICT_MAP[dict] || [] : []
}
</script>

<template>
  <div class="app-container">
    <!-- 搜索区 -->
    <el-card v-if="searchFields.length" class="search-card" shadow="never">
      <el-form :model="searchModel" inline @submit.prevent>
        <el-form-item v-for="f in searchFields" :key="f.prop" :label="f.label">
          <el-select
            v-if="f.type === 'select'"
            v-model="searchModel[f.prop]"
            :placeholder="f.placeholder || `请选择${f.label}`"
            clearable
            style="width: 170px"
          >
            <el-option v-for="o in dictOptions(f.dict)" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
          <el-input
            v-else
            v-model="searchModel[f.prop]"
            :placeholder="f.placeholder || `请输入${f.label}`"
            clearable
            style="width: 170px"
          />
        </el-form-item>
        <el-form-item>
          <div class="search-btns">
            <el-button type="primary" icon="Search" @click="Object.assign(query, searchModel); search()">搜索</el-button>
            <el-button icon="Refresh" @click="searchModel = {}; reset()">重置</el-button>
          </div>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="table-card" shadow="never">
      <ProTable
        :columns="columns"
        :data="list"
        :loading="loading"
        :name="name"
        selectable
        @refresh="search"
        @selection-change="handleSelectionChange"
      >
        <template #actions>
          <el-button v-permission="`wms:${name}:add`" type="primary" icon="Plus" @click="openCreate">新增</el-button>
          <el-button
            v-permission="`wms:${name}:delete`"
            type="danger"
            icon="Delete"
            plain
            :disabled="!selection.length"
            @click="onBatchDelete"
          >
            批量删除
          </el-button>
          <el-button v-permission="`wms:${name}:export`" icon="Download" :loading="exporting" @click="onExport">导出</el-button>
          <el-upload
            v-if="hasPerm(`wms:${name}:import`)"
            :before-upload="beforeUpload"
            :show-file-list="false"
            accept=".xlsx,.xls"
            style="display: inline-block; margin-left: 8px"
          >
            <el-button icon="Upload">导入</el-button>
          </el-upload>
          <el-button link type="primary" @click="onDownloadTemplate">下载模板</el-button>
        </template>

        <el-table-column label="操作" width="150" align="center" fixed="right">
          <template #default="{ row }">
            <span v-permission="`wms:${name}:edit`" class="link-btn" @click="openEdit(row)">编辑</span>
            <span v-permission="`wms:${name}:delete`" class="link-btn danger" @click="onDelete(row)">删除</span>
          </template>
        </el-table-column>

        <template #pagination>
          <el-pagination
            v-model:current-page="query.page"
            v-model:page-size="query.pageSize"
            :total="total"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next, jumper"
            background
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
          />
        </template>
      </ProTable>
    </el-card>

    <!-- 新增/编辑 -->
    <el-dialog
      v-model="visible"
      :title="isEdit ? '编辑' : '新增'"
      width="620px"
      class="sw-dialog"
      :close-on-click-modal="false"
    >
      <el-form ref="formRef" :model="formData" label-width="96px">
        <el-row :gutter="16">
          <el-col v-for="f in fields" :key="f.prop" :span="f.span || 12">
            <el-form-item :label="f.label" :required="f.required">
              <el-select
                v-if="f.type === 'select'"
                v-model="formData[f.prop]"
                :placeholder="f.placeholder || `请选择${f.label}`"
                style="width: 100%"
              >
                <el-option v-for="o in dictOptions(f.dict)" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
              <el-input-number
                v-else-if="f.type === 'number'"
                v-model="formData[f.prop]"
                :controls="false"
                style="width: 100%"
              />
              <el-switch v-else-if="f.type === 'switch'" v-model="formData[f.prop]" />
              <el-input
                v-else-if="f.type === 'textarea'"
                v-model="formData[f.prop]"
                type="textarea"
                :rows="2"
                :placeholder="f.placeholder"
              />
              <el-input v-else v-model="formData[f.prop]" :placeholder="f.placeholder || `请输入${f.label}`" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="close">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onSave">确定</el-button>
      </template>
    </el-dialog>

    <!-- 导入错误明细 -->
    <el-dialog v-model="importVisible" title="导入失败明细" width="640px" class="sw-dialog">
      <el-table :data="importErrors" size="small" max-height="360" border>
        <el-table-column prop="row" label="行号" width="80" align="center" />
        <el-table-column prop="label" label="字段" width="120" />
        <el-table-column prop="value" label="值" width="140" />
        <el-table-column prop="message" label="失败原因" />
      </el-table>
      <template #footer>
        <el-button type="primary" @click="importVisible = false">我知道了</el-button>
      </template>
    </el-dialog>
  </div>
</template>
