<script setup lang="ts">
/**
 * 库存预警
 * 亮点：不只是列清单，而是让 AI 对当前预警生成自然语言摘要与补货建议
 */
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { stockApi } from '@/api/biz'
import ProTable, { type ProColumn } from '@/components/ProTable.vue'
import DictTag from '@/components/DictTag.vue'
import { useAppStore } from '@/stores/app'
import { explainWarning } from '@/api/ai'
import type { StockWarnItem } from '@/api/types'

defineOptions({ name: 'StockWarn' })

const appStore = useAppStore()
const rows = ref<StockWarnItem[]>([])
const loading = ref(false)
const aiResult = ref('')
const aiLoading = ref(false)

const columns: ProColumn[] = [
  { label: '商品编码', prop: 'goodsCode', width: 130 },
  { label: '商品名称', prop: 'goodsName', minWidth: 170 },
  { label: '所属仓库', prop: 'warehouseName', width: 140 },
  { label: '当前库存', prop: 'qty', width: 110, align: 'right' },
  { label: '安全库存', prop: 'safetyStock', width: 110, align: 'right' },
  { label: '缺口', prop: 'gapQty', width: 100, align: 'right', slot: true },
  { label: '临期天数', prop: 'expireInDays', width: 110, align: 'right', slot: true },
  { label: '预警级别', prop: 'level', width: 110, align: 'center', dict: 'warn_level', dictDot: true }
]

async function load() {
  loading.value = true
  try {
    rows.value = await stockApi.warn()
  } finally {
    loading.value = false
  }
}

/** AI 解读：生成摘要 + 建议补货量 */
async function runAiExplain() {
  aiLoading.value = true
  aiResult.value = ''
  try {
    const res = await explainWarning()
    aiResult.value = res?.data?.text || res?.text || '未获取到结果'
  } catch (e: any) {
    ElMessage.error('AI 解读失败：' + (e.message || '请稍后重试'))
  } finally {
    aiLoading.value = false
  }
}

/** 直接唤起 AI 助手继续追问 */
function askAi() {
  appStore.openAi('chat')
}

onMounted(load)
</script>

<template>
  <div class="app-container">
    <el-card class="table-card" shadow="never" style="margin-bottom: 14px">
      <div class="ai-bar">
        <div>
          <div class="t">AI 预警解读</div>
          <p class="d">让 AI 基于当前预警清单生成摘要，并给出建议补货量与优先级排序</p>
        </div>
        <div class="ops">
          <el-button type="primary" icon="MagicStick" :loading="aiLoading" @click="runAiExplain">生成解读</el-button>
          <el-button icon="ChatDotRound" @click="askAi">继续追问</el-button>
        </div>
      </div>
      <div v-if="aiResult" class="ai-result">{{ aiResult }}</div>
      <div v-else-if="!aiLoading" class="ai-empty">尚未生成解读，点击「生成解读」后结果将显示在这里</div>
    </el-card>

    <el-card class="table-card" shadow="never">
      <ProTable :columns="columns" :data="rows" :loading="loading" name="stock-warn" @refresh="load">
        <template #actions>
          <span class="count">共 <b class="num">{{ rows.length }}</b> 条预警</span>
        </template>
        <template #gapQty="{ row }">
          <span class="num gap">-{{ row.gapQty }}</span>
        </template>
        <template #expireInDays="{ row }">
          <span v-if="row.expireInDays <= 0" class="expired">已过期</span>
          <span v-else-if="row.expireInDays <= 30" class="expire-soon num">{{ row.expireInDays }} 天</span>
          <span v-else class="num">{{ row.expireInDays }} 天</span>
        </template>
      </ProTable>
    </el-card>
  </div>
</template>

<style scoped>
.ai-bar { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.ai-bar .t { font-size: 15px; font-weight: 600; }
.ai-bar .d { font-size: 12.5px; color: var(--sw-text-3); margin: 4px 0 0; }
.ai-bar .ops { display: flex; gap: 8px; flex: 0 0 auto; }

.ai-result {
  margin-top: 12px;
  padding: 12px 14px;
  background: var(--sw-fill);
  border-left: 3px solid var(--sw-primary);
  border-radius: var(--sw-radius);
  font-size: 13px;
  line-height: 1.9;
  white-space: pre-wrap;
}
.ai-empty { margin-top: 10px; font-size: 12.5px; color: var(--sw-text-4); }

.count { font-size: 13px; color: var(--sw-text-2); line-height: 32px; }
.count b { color: var(--sw-danger); font-size: 15px; }
.gap { color: var(--sw-danger); font-weight: 600; }
.expired { color: var(--sw-danger); font-weight: 600; }
.expire-soon { color: var(--sw-warning); font-weight: 600; }
.num { font-variant-numeric: tabular-nums; }
</style>
