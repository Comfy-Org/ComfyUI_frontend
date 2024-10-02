import { createI18n } from 'vue-i18n'

const messages = {
  en: {
    insert: 'Insert',
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
    loading: 'Loading',
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
    searchWorkflows: 'Search Workflows',
    searchSettings: 'Search Settings',
    searchNodes: 'Search Nodes',
    searchModels: 'Search Models',
    noResultsFound: 'No Results Found',
    searchFailedMessage:
      "We couldn't find any settings matching your search. Try adjusting your search terms.",
    noContent: '(No Content)',
    noTasksFound: 'No Tasks Found',
    noTasksFoundMessage: 'There are no tasks in the queue.',
    newFolder: 'New Folder',
    sideToolbar: {
      themeToggle: 'Toggle Theme',
      queue: 'Queue',
      nodeLibrary: 'Node Library',
      workflows: 'Workflows',
      browseTemplates: 'Browse example templates',
      nodeLibraryTab: {
        sortOrder: 'Sort Order'
      },
      modelLibrary: 'Model Library',
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
      queue: 'Queue',
      interrupt: 'Cancel current run',
      refresh: 'Refresh node definitions',
      clipspace: 'Open Clipspace',
      resetView: 'Reset canvas view',
      clear: 'Clear workflow'
    },
    templateWorkflows: {
      title: 'Get Started with a Template',
      template: {
        default: 'Image Generation',
        image2image: 'Image to Image',
        upscale: '2 Pass Upscale',
        flux_schnell: 'Flux Schnell'
      }
    },
    graphCanvasMenu: {
      zoomIn: 'Zoom In',
      zoomOut: 'Zoom Out',
      resetView: 'Reset View',
      selectMode: 'Select Mode',
      panMode: 'Pan Mode',
      toggleLinkVisibility: 'Toggle Link Visibility'
    }
  },
  zh: {
    insert: '插入',
    systemInfo: '系统信息',
    devices: '设备',
    about: '关于',
    add: '添加',
    confirm: '确认',
    reset: '重置',
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
    loading: '加载中',
    findIssues: '查找 Issue',
    copyToClipboard: '复制到剪贴板',
    openNewIssue: '开启新 Issue',
    showReport: '显示报告',
    imageFailedToLoad: '图像加载失败',
    reconnecting: '重新连接中',
    reconnected: '已重新连接',
    delete: '删除',
    rename: '重命名',
    customize: '定制',
    experimental: '测试',
    deprecated: '弃用',
    loadWorkflow: '加载工作流',
    goToNode: '前往节点',
    settings: '设置',
    searchWorkflows: '搜索工作流',
    searchSettings: '搜索设置',
    searchNodes: '搜索节点',
    searchModels: '搜索模型',
    noResultsFound: '未找到结果',
    searchFailedMessage:
      '我们找不到与您的搜索匹配的任何设置。请尝试调整搜索条件。',
    noContent: '(无内容)',
    noTasksFound: '未找到任务',
    noTasksFoundMessage: '队列中没有任务。',
    newFolder: '新建文件夹',
    sideToolbar: {
      themeToggle: '主题切换',
      queue: '队列',
      nodeLibrary: '节点库',
      workflows: '工作流',
      browseTemplates: '浏览示例模板',
      nodeLibraryTab: {
        sortOrder: '排序顺序'
      },
      modelLibrary: '模型库',
      queueTab: {
        showFlatList: '平铺结果',
        backToAllTasks: '返回',
        containImagePreview: '填充图像预览',
        coverImagePreview: '适应图像预览',
        clearPendingTasks: '清除待处理任务'
      }
    },
    menu: {
      batchCount: '批次数量',
      batchCountTooltip: '工作流生成次数',
      autoQueue: '自动执行',
      disabled: '禁用',
      disabledTooltip: '工作流将不会自动执行',
      instant: '实时',
      instantTooltip: '工作流将会在生成完成后立即执行',
      change: '变动',
      changeTooltip: '工作流将会在改变后执行',
      queueWorkflow: '执行工作流',
      queue: '队列',
      interrupt: '取消当前任务',
      refresh: '刷新节点',
      clipspace: '打开剪贴板',
      resetView: '重置画布视图',
      clear: '清空工作流'
    },
    templateWorkflows: {
      title: '从模板开始',
      template: {
        default: 'Image Generation',
        image2image: 'Image to Image',
        upscale: '2 Pass Upscale',
        flux_schnell: 'Flux Schnell'
      }
    },
    graphCanvasMenu: {
      zoomIn: '放大',
      zoomOut: '缩小',
      resetView: '重置视图',
      selectMode: '选择模式',
      panMode: '平移模式',
      toggleLinkVisibility: '切换链接可见性'
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
