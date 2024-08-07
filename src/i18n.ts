import { createI18n } from 'vue-i18n'

const messages = {
  en: {
    sideToolBar: {
      settings: 'Settings',
      themeToggle: 'Toggle Theme',
      queue: 'Queue',
      nodeLibrary: 'Node Library',
      nodeLibraryTab: {
        sortOrder: 'Sort Order'
      },
      workflows: 'Workflows'
    }
  },
  zh: {
    sideToolBar: {
      settings: '设置',
      themeToggle: '主题切换',
      queue: '队列',
      nodeLibrary: '节点库',
      nodeLibraryTab: {
        sortOrder: '排序顺序'
      },
      workflows: '工作流'
    }
  }
  // TODO: Add more languages
}

export const i18n = createI18n({
  // Must set `false`, as Vue I18n Legacy API is for Vue 2
  legacy: false,
  locale: navigator.language.split('-')[0] || 'en',
  fallbackLocale: 'en',
  messages
})
