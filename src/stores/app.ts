import { defineStore } from 'pinia'

export type ThemeName = 'light' | 'dark'
/** AI 助手场景：通用问答 / 查数据 / 智能填单 / 报表解读 */
export type AiScene = 'chat' | 'query' | 'fill' | 'explain'

interface AppState {
  sidebarCollapsed: boolean
  theme: ThemeName
  device: 'desktop' | 'mobile'
  /** AI 助手侧边栏是否展开 */
  aiPanelVisible: boolean
  /** 当前 AI 场景，由业务页面唤起时指定 */
  aiScene: AiScene
}

const THEME_KEY = 'smartwms_theme'

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    sidebarCollapsed: false,
    theme: (localStorage.getItem(THEME_KEY) as ThemeName) || 'light',
    device: 'desktop',
    aiPanelVisible: false,
    aiScene: 'chat'
  }),
  actions: {
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed
    },
    setTheme(theme: ThemeName) {
      this.theme = theme
      localStorage.setItem(THEME_KEY, theme)
    },
    toggleTheme() {
      this.setTheme(this.theme === 'dark' ? 'light' : 'dark')
    },
    toggleAiPanel(visible?: boolean) {
      this.aiPanelVisible = visible === undefined ? !this.aiPanelVisible : visible
    },
    /** 以指定场景唤起 AI 助手 */
    openAi(scene: AiScene = 'chat') {
      this.aiScene = scene
      this.aiPanelVisible = true
    }
  }
})
