import { onMounted, onBeforeUnmount, shallowRef, type Ref } from 'vue'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'

/**
 * ECharts 实例托管
 * - 容器尺寸变化自动 resize（ResizeObserver，比 window.resize 更准）
 * - 组件卸载销毁实例并解绑，避免大屏长时间运行内存泄漏
 * - 离屏（页面不可见）暂停渲染
 */
export function useEcharts(
  el: Ref<HTMLElement | null>,
  optionFactory: () => EChartsOption,
  hooks?: { onReady?: (chart: echarts.ECharts) => void }
) {
  const chart = shallowRef<echarts.ECharts | null>(null)
  let observer: ResizeObserver | null = null
  let disposed = false

  function init() {
    if (!el.value || disposed) return
    chart.value = echarts.init(el.value, undefined, { renderer: 'canvas' })
    chart.value.setOption(optionFactory())
    hooks?.onReady?.(chart.value)

    observer = new ResizeObserver(() => {
      // 节流到下一帧，避免 resize 风暴
      requestAnimationFrame(() => chart.value?.resize())
    })
    observer.observe(el.value)
  }

  /** 增量更新：notMerge=false 时 ECharts 内部做差异合并，不做整图重绘 */
  function setOption(option: EChartsOption, notMerge = false) {
    chart.value?.setOption(option, notMerge)
  }

  function resize() {
    chart.value?.resize()
  }

  function dispose() {
    disposed = true
    observer?.disconnect()
    observer = null
    chart.value?.dispose()
    chart.value = null
  }

  onMounted(init)
  onBeforeUnmount(dispose)

  return { chart, setOption, resize, dispose }
}

/** 大屏统一的图表基础样式 */
export const SCREEN_CHART_BASE = {
  textStyle: { color: '#e8f0ff', fontSize: 12 },
  grid: { left: 46, right: 16, top: 28, bottom: 26, containLabel: false },
  tooltip: {
    trigger: 'axis' as const,
    backgroundColor: 'rgba(5, 14, 34, 0.92)',
    borderColor: 'rgba(64, 158, 255, 0.4)',
    textStyle: { color: '#e8f0ff', fontSize: 12 }
  },
  legend: { textStyle: { color: '#8fa8c8', fontSize: 11 }, itemWidth: 12, itemHeight: 8 }
}

/** 浅色后台内嵌迷你图的样式 */
export const MINI_CHART_BASE = {
  grid: { left: 40, right: 12, top: 20, bottom: 24 },
  tooltip: { trigger: 'axis' as const }
}
