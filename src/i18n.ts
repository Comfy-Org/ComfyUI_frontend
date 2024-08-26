import { createI18n } from 'vue-i18n'

const messages = {
  en: {
    error: 'Error',
    findIssues: 'Find Issues',
    copyToClipboard: 'Copy to Clipboard',
    openNewIssue: 'Open New Issue',
    showReport: 'Show Report',
    imageFailedToLoad: 'Image failed to load',
    reconnecting: 'Reconnecting',
    reconnected: 'Reconnected',
    delete: 'Delete',
    rename: 'Rename',
    customize: 'Customize',
    experimental: 'BETA',
    deprecated: 'DEPR',
    loadWorkflow: 'Load Workflow',
    settings: 'Settings',
    searchSettings: 'Search Settings',
    searchNodes: 'Search Nodes',
    noResultsFound: 'No Results Found',
    searchFailedMessage:
      "We couldn't find any settings matching your search. Try adjusting your search terms.",
    noTasksFound: 'No Tasks Found',
    noTasksFoundMessage: 'There are no tasks in the queue.',
    newFolder: 'New Folder',
    sideToolbar: {
      themeToggle: 'Toggle Theme',
      queue: 'Queue',
      nodeLibrary: 'Node Library',
      nodeLibraryTab: {
        sortOrder: 'Sort Order'
      },
      queueTab: {
        showFlatList: 'Show Flat List',
        backToAllTasks: 'Back to All Tasks'
      }
    }
  },
  zh: {
    error: '错误',
    showReport: '显示报告',
    imageFailedToLoad: '图像加载失败',
    reconnecting: '重新连接中',
    reconnected: '已重新连接',
    delete: '删除',
    rename: '重命名',
    customize: '定制',
    loadWorkflow: '加载工作流',
    settings: '设置',
    searchSettings: '搜索设置',
    searchNodes: '搜索节点',
    noResultsFound: '未找到结果',
    noTasksFound: '未找到任务',
    noTasksFoundMessage: '队列中没有任务。',
    searchFailedMessage:
      '我们找不到与您的搜索匹配的任何设置。请尝试调整搜索条件。',
    newFolder: '新建文件夹',
    sideToolbar: {
      themeToggle: '主题切换',
      queue: '队列',
      nodeLibrary: '节点库',
      nodeLibraryTab: {
        sortOrder: '排序顺序'
      },
      queueTab: {
        showFlatList: '平铺结果',
        backToAllTasks: '返回'
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
