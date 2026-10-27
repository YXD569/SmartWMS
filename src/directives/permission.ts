/**
 * 按钮级权限指令
 * 用法：v-permission="'wms:goods:add'"  或  v-permission="['a','b']"（任一命中）
 * 无权限时直接移除 DOM，比 v-if 更彻底，避免源码里能看到按钮结构
 */
import type { Directive, DirectiveBinding } from 'vue'
import { useUserStore } from '@/stores/user'

function check(el: HTMLElement, binding: DirectiveBinding) {
  const userStore = useUserStore()
  const { value } = binding
  if (!value) return

  const required: string[] = Array.isArray(value) ? value : [value]
  // 超管标识，拥有全部权限
  if (userStore.permissions.includes('*:*')) return

  const has = required.some((p) => userStore.permissions.includes(p))
  if (!has && el.parentNode) {
    el.parentNode.removeChild(el)
  }
}

export const permissionDirective: Directive = {
  mounted(el, binding) {
    check(el, binding)
  }
}
