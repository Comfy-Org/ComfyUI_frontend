import { createI18n } from 'vue-i18n'

const messages = {
  en: {
    delete: 'Delete',
    experimental: 'BETA',
    loadWorkflow: 'Load Workflow',
    settings: 'Settings',
    searchSettings: 'Search Settings',
    noResultsFound: 'No Results Found',
    searchFailedMessage:
      "We couldn't find any settings matching your search. Try adjusting your search terms.",
    noTasksFound: 'No Tasks Found',
    noTasksFoundMessage: 'There are no tasks in the queue.',
    sideToolbar: {
      themeToggle: 'Toggle Theme',
      queue: 'Queue',
      nodeLibrary: 'Node Library',
      nodeLibraryTab: {
        sortOrder: 'Sort Order'
      },
      queueTab: {
        showFlatList: 'Show Flat List'
      }
    }
  },
  zh: {
    delete: '删除',
    loadWorkflow: '加载工作流',
    settings: '设置',
    searchSettings: '搜索设置',
    noResultsFound: '未找到结果',
    noTasksFound: '未找到任务',
    noTasksFoundMessage: '队列中没有任务。',
    searchFailedMessage:
      '我们找不到与您的搜索匹配的任何设置。请尝试调整搜索条件。',
    sideToolbar: {
      themeToggle: '主题切换',
      queue: '队列',
      nodeLibrary: '节点库',
      nodeLibraryTab: {
        sortOrder: '排序顺序'
      },
      queueTab: {
        showFlatList: '平铺结果'
      }
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
