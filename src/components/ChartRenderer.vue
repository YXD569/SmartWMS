<script setup lang="ts">
/**
 * ChartRenderer：配置驱动的图表渲染引擎
 * ------------------------------------------------------------------
 * 一份 JSON 描述「图表类型 + 数据 + 字段映射」，引擎统一渲染。
 * 收益：大屏新增图表零改代码；AI 自然语言查数据的结果可以直接产出配置交给它出图，
 * 于是「AI 模块」和「BI 大屏」共用同一套渲染能力，而不是各写一套。
 */
import { ref, computed, watch } from 'vue'
import { useEcharts, SCREEN_CHART_BASE, MINI_CHART_BASE } from '@/composables/useEcharts'
import type { EChartsOption } from 'echarts'

export interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'heatmap' | 'gauge'
  /** 数据行 */
  rows: Record<string, unknown>[]
  /** 类目轴 / 类名字段 */
  xField: string
  /** 数值字段（可多个系列） */
  yFields: string[]
  /** 系列别名 */
  names?: string[]
  /** 主题：screen=大屏深色，light=后台浅色 */
  theme?: 'screen' | 'light'
  title?: string
}

const props = withDefaults(defineProps<{ config: ChartConfig; height?: number }>(), { height: 260 })

const el = ref<HTMLElement | null>(null)

const base = computed(() => (props.config.theme === 'screen' ? SCREEN_CHART_BASE : MINI_CHART_BASE))

const option = computed<EChartsOption>(() => {
  const c = props.config
  const rows = c.rows || []
  const categories = rows.map((r) => String(r[c.xField] ?? ''))

  if (c.type === 'pie') {
    return {
      ...base.value,
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'pie',
          radius: ['40%', '66%'],
          data: rows.map((r) => ({ name: String(r[c.xField] ?? ''), value: Number(r[c.yFields[0]] ?? 0) })),
          label: { fontSize: 11 }
        }
      ]
    } as EChartsOption
  }

  if (c.type === 'heatmap') {
    // 热力图需要 x/y/value 三元组：xField=仓库，yFields[0]=库区，yFields[1]=值
    const xSet = Array.from(new Set(rows.map((r) => String(r[c.xField] ?? ''))))
    const ySet = Array.from(new Set(rows.map((r) => String(r[c.yFields[0]] ?? ''))))
    const data = rows.map((r) => [
      xSet.indexOf(String(r[c.xField] ?? '')),
      ySet.indexOf(String(r[c.yFields[0]] ?? '')),
      Number(r[c.yFields[1]] ?? 0)
    ])
    const max = Math.max(1, ...data.map((d) => d[2] as number))
    return {
      ...base.value,
      grid: { left: 70, right: 16, top: 16, bottom: 60 },
      tooltip: { position: 'top' },
      xAxis: { type: 'category', data: xSet, splitArea: { show: true } },
      yAxis: { type: 'category', data: ySet, splitArea: { show: true } },
      visualMap: {
        min: 0,
        max,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        inRange: { color: ['#0b2a52', '#1a5fa8', '#23d7ff'] },
        textStyle: { color: '#8fa8c8', fontSize: 10 }
      },
      series: [{ type: 'heatmap', data, label: { show: false } }]
    } as EChartsOption
  }

  if (c.type === 'gauge') {
    const value = Number(rows[0]?.[c.yFields[0]] ?? 0)
    return {
      series: [
        {
          type: 'gauge',
          startAngle: 200,
          endAngle: -20,
          min: 0,
          max: 100,
          progress: { show: true, width: 12 },
          axisLine: { lineStyle: { width: 12, color: [[1, 'rgba(64,158,255,0.25)']] } },
          axisTick: { show: false },
          splitLine: { length: 10, lineStyle: { color: 'rgba(64,158,255,0.35)' } },
          axisLabel: { color: '#8fa8c8', fontSize: 10, distance: 14 },
          pointer: { width: 4, itemStyle: { color: '#23d7ff' } },
          detail: { valueAnimation: true, fontSize: 22, color: '#23d7ff', offsetCenter: [0, '62%'] },
          data: [{ value }]
        }
      ]
    } as EChartsOption
  }

  // line / bar
  const palette = ['#23d7ff', '#ffb547', '#4ade80', '#a78bfa', '#f472b6']
  const lightPalette = ['#409eff', '#67c23a', '#e6a23c', '#909399', '#f56c6c']
  const colors = props.config.theme === 'screen' ? palette : lightPalette

  return {
    ...base.value,
    legend: { ...(base.value as any).legend, data: c.names || c.yFields },
    xAxis: { type: 'category', data: categories, axisLabel: { fontSize: 11, interval: 'auto' } },
    yAxis: { type: 'value' },
    series: c.yFields.map((f, i) => ({
      name: c.names?.[i] || f,
      type: c.type,
      smooth: c.type === 'line',
      data: rows.map((r) => Number(r[f] ?? 0)),
      itemStyle: { color: colors[i % colors.length] },
      areaStyle: c.type === 'line' ? { opacity: 0.14 } : undefined,
      barMaxWidth: 22
    }))
  } as EChartsOption
})

const { setOption } = useEcharts(el, () => option.value)

// 配置变化时增量更新（notMerge=false 让 ECharts 内部做差异合并，不整图重绘）
watch(
  () => props.config,
  () => setOption(option.value),
  { deep: true }
)
</script>

<template>
  <div ref="el" class="chart-renderer" :style="{ height: `${height}px` }" />
</template>

<style scoped>
.chart-renderer { width: 100%; }
</style>
