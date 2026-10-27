import { useUserStore } from '@/stores/user'

/** 组合式权限判断：用于 v-if 场景（指令适合直接移除 DOM） */
export function usePermission() {
  const userStore = useUserStore()

  function hasPerm(perm: string | string[]): boolean {
    if (userStore.permissions.includes('*:*')) return true
    const list = Array.isArray(perm) ? perm : [perm]
    return list.some((p) => userStore.permissions.includes(p))
  }

  function hasRole(role: string | string[]): boolean {
    const list = Array.isArray(role) ? role : [role]
    return list.some((r) => userStore.roles.includes(r))
  }

  /** 数据权限：能否查看某仓库数据 */
  function canSeeWarehouse(warehouseId: number): boolean {
    if (userStore.dataScope === 'ALL') return true
    return userStore.warehouseIds.includes(warehouseId)
  }

  return { hasPerm, hasRole, canSeeWarehouse }
}
