<script setup lang="ts">
/**
 * BillPage：单据页通用实现（采购 / 销售 / 盘点共用）
 * ------------------------------------------------------------------
 * 承载两个面试核心考点：
 * 1. 主子表编辑：单据头 + 明细行，行内增删改、金额联动、合计自动计算
 * 2. 单据状态机：草稿→待审→已审→执行中→完成/作废，可执行动作由状态推导，
 *    前端只做展示与引导，合法性由后端校验（前端校验可被绕过）
 */
import { ref, computed, reactive, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { billApi } from '@/api/biz'
import { goodsApi, warehouseApi, supplierApi, customerApi } from '@/api/base'
import ProTable, { type ProColumn } from '@/components/ProTable.vue'
import DictTag from '@/components/DictTag.vue'
import { useTable } from '@/composables/useTable'
import { usePermission } from '@/composables/usePermission'
import { useAppStore } from '@/stores/app'
import { emitter, AI_FILL_RESULT } from '@/utils/emitter'
import { allowedActions, ACTION_LABEL, BILL_STATUS } from '@/utils/dict'
import { money, number, datetime } from '@/utils/format'
import type { Bill, BillItem, BillPayload } from '@/api/types'

const props = defineProps<{
  bizType: 'PURCHASE' | 'SALE' | 'CHECK'
  /** 合作方字段名：采购=供应商，销售=客户，盘点不传 */
  partnerLabel?: string
  /** 明细列模式：check 表示盘点（账面/实盘/差异） */
  itemMode?: 'normal' | 'check'
}>()

const { hasPerm } = usePermission()
const appStore = useAppStore()
const permKey = computed(() => ({ PURCHASE: 'purchase', SALE: 'sale', CHECK: 'check' }[props.bizType]))

const { list, total, loading, query, search, reset, handleSizeChange, handleCurrentChange } = useTable(
  (p) => billApi.list(props.bizType, p),
  { defaultQuery: {} }
)

// ---------------- 下拉数据 ----------------
const goodsList = ref<any[]>([])
const warehouseList = ref<any[]>([])
const partnerList = ref<any[]>([])

async function loadOptions() {
  goodsList.value = await goodsApi.all()
  warehouseList.value = await warehouseApi.all()
  partnerList.value = props.bizType === 'PURCHASE' ? await supplierApi.all() : props.bizType === 'SALE' ? await customerApi.all() : []
}

// ---------------- 列表列 ----------------
const columns = computed<ProColumn[]>(() => {
  const cols: ProColumn[] = [
    { label: '单据编号', prop: 'code', width: 150 },
    ...(props.partnerLabel ? ([{ label: props.partnerLabel, prop: 'partnerName', width: 160 }] as ProColumn[]) : []),
    { label: '仓库', prop: 'warehouseName', width: 130 },
    { label: '总数量', prop: 'totalQty', width: 100, align: 'right', formatter: (r: any) => number(r.totalQty) },
    ...(props.itemMode === 'check'
      ? []
      : ([{ label: '总金额', prop: 'totalAmount', width: 120, align: 'right', formatter: (r: any) => money(r.totalAmount) }] as ProColumn[])),
    { label: '状态', prop: 'status', width: 100, align: 'center', dict: 'bill_status', dictDot: true },
    { label: '创建人', prop: 'creator', width: 100 },
    { label: '创建时间', prop: 'createTime', width: 170, formatter: (r: any) => datetime(r.createTime) }
  ]
  return cols
})

const searchModel = reactive<Record<string, unknown>>({})

// ---------------- 主子表编辑 ----------------
const dialogVisible = ref(false)
const saving = ref(false)
const isEdit = ref(false)
const form = reactive<BillPayload>({
  bizType: props.bizType,
  warehouseId: undefined as unknown as number,
  partnerId: undefined as unknown as number,
  remark: '',
  items: []
})
const editingId = ref<number | null>(null)

function emptyItem(): BillItem {
  return {
    goodsId: 0,
    goodsCode: '',
    goodsName: '',
    spec: '',
    unit: '',
    qty: 1,
    price: 0,
    amount: 0,
    bookQty: 0,
    realQty: 0,
    diffQty: 0
  }
}

function openCreate() {
  isEdit.value = false
  editingId.value = null
  form.bizType = props.bizType
  form.warehouseId = warehouseList.value[0]?.id
  form.partnerId = partnerList.value[0]?.id
  form.remark = ''
  form.items = [emptyItem()]
  dialogVisible.value = true
}

async function openEdit(row: Bill) {
  const detail = await billApi.detail(row.id)
  isEdit.value = true
  editingId.value = row.id
  Object.assign(form, {
    bizType: props.bizType,
    warehouseId: detail.warehouseId,
    partnerId: detail.partnerId,
    remark: detail.remark,
    items: detail.items.map((i) => ({ ...i }))
  })
  dialogVisible.value = true
}

function addRow() {
  form.items.push(emptyItem())
}

function removeRow(index: number) {
  form.items.splice(index, 1)
}

/** 选择商品后带出编码、规格、单位与单价 */
function onGoodsChange(row: BillItem, goodsId: number) {
  const g = goodsList.value.find((x) => x.id === goodsId)
  if (!g) return
  row.goodsId = g.id
  row.goodsCode = g.code
  row.goodsName = g.name
  row.spec = g.spec
  row.unit = g.unit
  row.price = props.bizType === 'SALE' ? g.salePrice : g.purchasePrice
  calcAmount(row)
}

/** 金额联动：数量 × 单价 */
function calcAmount(row: BillItem) {
  row.amount = Number((Number(row.qty || 0) * Number(row.price || 0)).toFixed(2))
}

/** 盘点差异 = 实盘 - 账面 */
function calcDiff(row: BillItem) {
  row.diffQty = Number(row.realQty || 0) - Number(row.bookQty || 0)
  row.qty = row.diffQty
}

const totalQty = computed(() => form.items.reduce((s, i) => s + Number(i.qty || 0), 0))
const totalAmount = computed(() => form.items.reduce((s, i) => s + Number(i.amount || 0), 0))

async function onSave(status?: string) {
  if (!form.items.length) {
    ElMessage.warning('请至少添加一条明细')
    return
  }
  if (form.items.some((i) => !i.goodsId)) {
    ElMessage.warning('明细中存在未选择商品的行')
    return
  }
  saving.value = true
  try {
    const payload: BillPayload = {
      ...form,
      id: editingId.value ?? undefined,
      status: status || (isEdit.value ? undefined : 'DRAFT')
    }
    await billApi.save(payload)
    ElMessage.success('保存成功')
    dialogVisible.value = false
    search()
  } finally {
    saving.value = false
  }
}

// ---------------- 状态机 ----------------
async function transfer(row: Bill, target: string) {
  const label = ACTION_LABEL[target] || target
  await ElMessageBox.confirm(`确定要「${label}」单据 ${row.code} 吗？`, '状态流转', { type: 'warning' })
  await billApi.transfer(row.id, target)
  ElMessage.success(`${label}成功`)
  search()
}

function actionsOf(row: Bill) {
  return allowedActions(row.status).filter((a) => a !== 'DRAFT' || row.status !== 'DRAFT')
}

async function onDelete(row: Bill) {
  await ElMessageBox.confirm(`确定删除单据 ${row.code} 吗？`, '提示', { type: 'warning' })
  await billApi.remove(row.id)
  ElMessage.success('删除成功')
  search()
}

// ---------------- 详情 ----------------
const detailVisible = ref(false)
const detail = ref<Bill | null>(null)
async function openDetail(row: Bill) {
  detail.value = await billApi.detail(row.id)
  detailVisible.value = true
}

// ---------------- AI 智能填单 ----------------
/** 唤起 AI 助手并切到填单场景，结果通过事件总线回填 */
function aiFill() {
  appStore.openAi('fill')
}

function onAiFillResult(payload: { items: BillItem[] }) {
  const items = payload?.items || []
  if (!items.length) return
  // 按名称匹配本地商品档案，补齐编码/规格/单位/单价，保证回填数据可直接保存
  const normalized = items.map((it) => {
    const g = goodsList.value.find(
      (x) => x.name === it.goodsName || x.code === it.goodsCode || x.id === it.goodsId
    )
    const row: BillItem = {
      ...emptyItem(),
      ...it,
      goodsId: g?.id || it.goodsId || 0,
      goodsCode: g?.code || it.goodsCode || '',
      goodsName: g?.name || it.goodsName || '',
      spec: g?.spec || '',
      unit: g?.unit || '',
      price: it.price || (props.bizType === 'SALE' ? g?.salePrice : g?.purchasePrice) || 0
    }
    calcAmount(row)
    return row
  })
  if (!dialogVisible.value) {
    openCreate()
  }
  form.items = normalized
  ElMessage.success(`AI 已识别 ${normalized.length} 行明细，请核对后保存`)
}

onMounted(() => emitter.on(AI_FILL_RESULT, onAiFillResult))
onBeforeUnmount(() => emitter.off(AI_FILL_RESULT, onAiFillResult))

loadOptions()
</script>

<template>
  <div class="app-container">
    <el-card class="search-card" shadow="never">
      <el-form :model="searchModel" inline @submit.prevent>
        <el-form-item label="单据编号">
          <el-input v-model="searchModel.code" placeholder="请输入单据编号" clearable style="width: 170px" />
        </el-form-item>
        <el-form-item v-if="partnerLabel" :label="partnerLabel">
          <el-select v-model="searchModel.partnerId" placeholder="请选择" clearable style="width: 170px">
            <el-option v-for="o in partnerList" :key="o.id" :label="o.name" :value="o.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchModel.status" placeholder="请选择" clearable style="width: 150px">
            <el-option v-for="s in BILL_STATUS" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <div class="search-btns">
            <el-button type="primary" icon="Search" @click="Object.assign(query, searchModel); search()">搜索</el-button>
            <el-button icon="Refresh" @click="Object.keys(searchModel).forEach((k) => delete searchModel[k]); reset()">重置</el-button>
          </div>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="table-card" shadow="never">
      <ProTable :columns="columns" :data="list" :loading="loading" :name="`bill-${permKey}`" @refresh="search">
        <template #actions>
          <el-button v-permission="`wms:bill:add`" type="primary" icon="Plus" @click="openCreate">新建单据</el-button>
        </template>

        <el-table-column label="操作" width="290" align="center" fixed="right">
          <template #default="{ row }">
            <span class="link-btn" @click="openDetail(row)">详情</span>
            <span v-if="row.status === 'DRAFT'" v-permission="'wms:bill:edit'" class="link-btn" @click="openEdit(row)">编辑</span>
            <span
              v-for="act in actionsOf(row)"
              :key="act"
              v-permission="'wms:bill:audit'"
              class="link-btn"
              :class="{ danger: act === 'CANCELED' }"
              @click="transfer(row, act)"
            >
              {{ ACTION_LABEL[act] }}
            </span>
            <span v-if="row.status === 'DRAFT'" v-permission="'wms:bill:delete'" class="link-btn danger" @click="onDelete(row)">删除</span>
          </template>
        </el-table-column>

        <template #pagination>
          <el-pagination
            v-model:current-page="query.page"
            v-model:page-size="query.pageSize"
            :total="total"
            :page-sizes="[10, 20, 50]"
            layout="total, sizes, prev, pager, next, jumper"
            background
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
          />
        </template>
      </ProTable>
    </el-card>

    <!-- 主子表编辑 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑单据' : '新建单据'"
      width="1080px"
      top="4vh"
      class="sw-dialog"
      :close-on-click-modal="false"
    >
      <el-form label-width="88px">
        <el-row :gutter="16">
          <el-col :span="6">
            <el-form-item label="仓库" required>
              <el-select v-model="form.warehouseId" placeholder="请选择仓库" style="width: 100%">
                <el-option v-for="w in warehouseList" :key="w.id" :label="w.name" :value="w.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col v-if="partnerLabel" :span="6">
            <el-form-item :label="partnerLabel" required>
              <el-select v-model="form.partnerId" placeholder="请选择" style="width: 100%">
                <el-option v-for="o in partnerList" :key="o.id" :label="o.name" :value="o.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="备注">
              <el-input v-model="form.remark" placeholder="选填" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <div class="sub-table-title">
        <span class="title">单据明细</span>
        <div>
          <el-button size="small" type="primary" icon="Plus" @click="addRow">添加行</el-button>
          <el-tooltip content="粘贴一段文本，由 AI 自动识别为明细行" placement="top">
            <el-button size="small" icon="MagicStick" @click="aiFill">AI 识别填入</el-button>
          </el-tooltip>
        </div>
      </div>

      <el-table :data="form.items" border size="small" max-height="380">
        <el-table-column type="index" label="#" width="46" align="center" />
        <el-table-column label="商品" min-width="220">
          <template #default="{ row }">
            <el-select
              :model-value="row.goodsId || undefined"
              filterable
              placeholder="选择商品"
              style="width: 100%"
              @change="(v: number) => onGoodsChange(row, v)"
            >
              <el-option v-for="g in goodsList" :key="g.id" :label="`${g.name}（${g.spec}）`" :value="g.id" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="单位" width="70" align="center">
          <template #default="{ row }">{{ row.unit || '-' }}</template>
        </el-table-column>

        <template v-if="itemMode === 'check'">
          <el-table-column label="账面数量" width="110">
            <template #default="{ row }">
              <el-input-number v-model="row.bookQty" :controls="false" :min="0" style="width: 100%" @change="calcDiff(row)" />
            </template>
          </el-table-column>
          <el-table-column label="实盘数量" width="110">
            <template #default="{ row }">
              <el-input-number v-model="row.realQty" :controls="false" :min="0" style="width: 100%" @change="calcDiff(row)" />
            </template>
          </el-table-column>
          <el-table-column label="差异" width="90" align="center">
            <template #default="{ row }">
              <span :class="row.diffQty < 0 ? 'diff-loss' : row.diffQty > 0 ? 'diff-profit' : ''">
                {{ row.diffQty > 0 ? '+' : '' }}{{ row.diffQty || 0 }}
              </span>
            </template>
          </el-table-column>
        </template>

        <template v-else>
          <el-table-column label="数量" width="110">
            <template #default="{ row }">
              <el-input-number v-model="row.qty" :controls="false" :min="1" style="width: 100%" @change="calcAmount(row)" />
            </template>
          </el-table-column>
          <el-table-column label="单价" width="110">
            <template #default="{ row }">
              <el-input-number v-model="row.price" :controls="false" :min="0" :precision="2" style="width: 100%" @change="calcAmount(row)" />
            </template>
          </el-table-column>
          <el-table-column label="金额" width="110" align="right">
            <template #default="{ row }">
              <span class="num">{{ money(row.amount) }}</span>
            </template>
          </el-table-column>
        </template>

        <el-table-column label="操作" width="70" align="center">
          <template #default="{ $index }">
            <el-button link type="danger" :disabled="form.items.length === 1" @click="removeRow($index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="bill-summary">
        <span>明细行数：<b class="num">{{ form.items.length }}</b></span>
        <span>合计数量：<b class="num">{{ number(totalQty) }}</b></span>
        <span v-if="itemMode !== 'check'">合计金额：<b class="num amount">¥ {{ money(totalAmount) }}</b></span>
        <span v-else>盘盈行：<b class="num profit">{{ form.items.filter((i: BillItem) => (i.diffQty || 0) > 0).length }}</b>　盘亏行：<b class="num loss">{{ form.items.filter((i: BillItem) => (i.diffQty || 0) < 0).length }}</b></span>
      </div>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" plain :loading="saving" @click="onSave('DRAFT')">保存草稿</el-button>
        <el-button type="primary" :loading="saving" @click="onSave('PENDING')">提交审核</el-button>
      </template>
    </el-dialog>

    <!-- 详情 -->
    <el-dialog v-model="detailVisible" title="单据详情" width="900px" class="sw-dialog">
      <el-descriptions :column="3" border size="small" class="sw-desc">
        <el-descriptions-item label="单据编号">{{ detail?.code }}</el-descriptions-item>
        <el-descriptions-item label="单据状态">
          <DictTag dict="bill_status" :value="detail?.status || ''" dot />
        </el-descriptions-item>
        <el-descriptions-item label="仓库">{{ detail?.warehouseName }}</el-descriptions-item>
        <el-descriptions-item v-if="partnerLabel" :label="partnerLabel">{{ detail?.partnerName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="总数量">{{ number(detail?.totalQty || 0) }}</el-descriptions-item>
        <el-descriptions-item label="总金额">¥ {{ money(detail?.totalAmount || 0) }}</el-descriptions-item>
        <el-descriptions-item label="创建人">{{ detail?.creator }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ datetime(detail?.createTime) }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="3">{{ detail?.remark || '-' }}</el-descriptions-item>
      </el-descriptions>

      <div class="sub-table-title mt16"><span class="title">明细</span></div>
      <el-table :data="detail?.items || []" border size="small" max-height="320">
        <el-table-column type="index" label="#" width="46" align="center" />
        <el-table-column label="商品编码" prop="goodsCode" width="120" />
        <el-table-column label="商品名称" prop="goodsName" min-width="160" />
        <el-table-column label="规格" prop="spec" width="110" />
        <el-table-column label="数量" prop="qty" width="90" align="right" />
        <el-table-column v-if="itemMode !== 'check'" label="单价" prop="price" width="100" align="right">
          <template #default="{ row }">{{ money(row.price) }}</template>
        </el-table-column>
        <el-table-column v-if="itemMode !== 'check'" label="金额" prop="amount" width="110" align="right">
          <template #default="{ row }">{{ money(row.amount) }}</template>
        </el-table-column>
        <template v-else>
          <el-table-column label="账面" prop="bookQty" width="80" align="right" />
          <el-table-column label="实盘" prop="realQty" width="80" align="right" />
          <el-table-column label="差异" width="80" align="right">
            <template #default="{ row }">
              <span :class="row.diffQty < 0 ? 'diff-loss' : row.diffQty > 0 ? 'diff-profit' : ''">{{ row.diffQty }}</span>
            </template>
          </el-table-column>
        </template>
      </el-table>
    </el-dialog>
  </div>
</template>

<style scoped>
.bill-summary {
  display: flex;
  gap: 26px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--sw-border-2);
  font-size: 13px;
  color: var(--sw-text-2);
}
.bill-summary b { color: var(--sw-text-1); font-size: 15px; }
.bill-summary .amount { color: var(--sw-danger); }
.diff-loss { color: var(--sw-danger); font-weight: 600; }
.diff-profit { color: var(--sw-success); font-weight: 600; }
.num { font-variant-numeric: tabular-nums; }
</style>
