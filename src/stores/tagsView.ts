import { defineStore } from 'pinia'
import type { RouteLocationNormalized } from 'vue-router'

export interface TagView {
  fullPath: string
  name: string
  title: string
  /** 是否固定（首页不可关闭） */
  affix: boolean
}

interface TagsViewState {
  visited: TagView[]
  cached: string[]
}

function isSame(a: TagView, route: RouteLocationNormalized): boolean {
  return a.fullPath === route.fullPath
}

export const useTagsViewStore = defineStore('tagsView', {
  state: (): TagsViewState => ({
    visited: [],
    cached: []
  }),
  actions: {
    addView(route: RouteLocationNormalized) {
      if (!route.name || route.meta?.hidden) return
      if (this.visited.some((v) => isSame(v, route))) return
      this.visited.push({
        fullPath: route.fullPath,
        name: String(route.name),
        title: (route.meta?.title as string) || '未命名',
        affix: !!route.meta?.affix
      })
      // 需要缓存的组件名入列，供 keep-alive 使用
      if (route.meta?.keepAlive && route.name) {
        this.cached.push(String(route.name))
      }
    },
    delView(route: RouteLocationNormalized): TagView[] {
      const idx = this.visited.findIndex((v) => isSame(v, route))
      if (idx === -1) return []
      const removed = this.visited.splice(idx, 1)
      const nameIdx = this.cached.indexOf(removed[0].name)
      if (nameIdx > -1) this.cached.splice(nameIdx, 1)
      return removed
    },
    delOthers(route: RouteLocationNormalized) {
      this.visited = this.visited.filter((v) => v.affix || isSame(v, route))
      this.cached = this.cached.filter((n) => n === String(route.name))
    },
    delAll() {
      this.visited = this.visited.filter((v) => v.affix)
      this.cached = []
    }
  }
})
