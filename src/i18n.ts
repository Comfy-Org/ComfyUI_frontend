import { createI18n } from 'vue-i18n'

const messages = {
  en: {
    systemInfo: 'System Info',
    devices: 'Devices',
    about: 'About',
    add: 'Add',
    confirm: 'Confirm',
    reset: 'Reset',
    customizeFolder: 'Customize Folder',
    icon: 'Icon',
    color: 'Color',
    bookmark: 'Bookmark',
    folder: 'Folder',
    star: 'Star',
    heart: 'Heart',
    file: 'File',
    inbox: 'Inbox',
    box: 'Box',
    briefcase: 'Briefcase',
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
    goToNode: 'Go to Node',
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
        backToAllTasks: 'Back to All Tasks',
        containImagePreview: 'Fill Image Preview',
        coverImagePreview: 'Fit Image Preview',
        clearPendingTasks: 'Clear Pending Tasks'
      }
    },
    menu: {
      batchCount: 'Batch Count',
      batchCountTooltip:
        'The number of times the workflow generation should be queued',
      autoQueue: 'Auto Queue',
      disabled: 'Disabled',
      disabledTooltip: 'The workflow will not be automatically queued',
      instant: 'Instant',
      instantTooltip:
        'The workflow will be queued instantly after a generation finishes',
      change: 'On Change',
      changeTooltip: 'The workflow will be queued once a change is made',
      queueWorkflow: 'Queue workflow',
      generate: 'Generate',
      interrupt: 'Cancel current run',
      refresh: 'Refresh node definitions',
      clipspace: 'Open Clipspace',
      resetView: 'Reset canvas view',
      clear: 'Clear workflow'
    }
  },
  zh: {
    customizeFolder: '定制文件夹',
    icon: '图标',
    color: '颜色',
    bookmark: '书签',
    folder: '文件夹',
    star: '星星',
    heart: '心',
    file: '文件',
    inbox: '收件箱',
    box: '盒子',
    briefcase: '公文包',
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
        backToAllTasks: '返回',
        clearPendingTasks: '清除待处理任务'
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
