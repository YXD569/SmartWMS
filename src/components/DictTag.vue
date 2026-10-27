<script setup lang="ts">
import { computed } from 'vue'
import { dictLabel, dictType, DICT_MAP, type DictItem } from '@/utils/dict'

const props = withDefaults(
  defineProps<{
    /** 字典 key（来自 DICT_MAP）或直接传字典数组 */
    dict: string | DictItem[]
    value: string | number
    size?: 'large' | 'default' | 'small'
    /** 是否显示状态圆点 */
    dot?: boolean
  }>(),
  { size: 'small', dot: false }
)

/** 支持两种传参：字典 key 或字典数组 */
const items = computed<DictItem[]>(() => {
  if (Array.isArray(props.dict)) return props.dict
  return DICT_MAP[props.dict as string] || []
})

const hit = computed(() => items.value.find((i) => String(i.value) === String(props.value)))

const label = computed(() => hit.value?.label ?? String(props.value ?? ''))
const type = computed(() => hit.value?.type ?? 'info')
</script>

<template>
  <el-tag :type="type" :size="size" effect="light" disable-transitions>
    <span v-if="dot" class="dot" :class="type"></span>
    {{ label }}
  </el-tag>
</template>

<style scoped>
.dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-right: 5px;
  background: var(--sw-info);
}
.dot.success { background: var(--sw-success); }
.dot.primary { background: var(--sw-primary); }
.dot.warning { background: var(--sw-warning); }
.dot.danger { background: var(--sw-danger); }
</style>
