import { createI18n } from 'vue-i18n'

const messages = {
  en: {
    install: {
      installLocation: 'Install Location',
      migration: 'Migration',
      desktopSettings: 'Desktop Settings',
      chooseInstallationLocation: 'Choose Installation Location',
      systemLocations: 'System Locations',
      failedToSelectDirectory: 'Failed to select directory',
      pathValidationFailed: 'Failed to validate path',
      installLocationDescription:
        "Select the directory for ComfyUI's user data. A python environment will be installed to the selected location. Please make sure the selected disk has enough space (~5GB) left.",
      installLocationTooltip:
        "ComfyUI's user data directory. Stores:\n- Python Environment\n- Models\n- Custom nodes\n",
      appDataLocationTooltip:
        "ComfyUI's app data directory. Stores:\n- Logs\n- Server configs",
      appPathLocationTooltip:
        "ComfyUI's app asset directory. Stores the ComfyUI code and assets",
      migrateFromExistingInstallation: 'Migrate from Existing Installation',
      migrationSourcePathDescription:
        'If you have an existing ComfyUI installation, we can copy/link your existing user files and models to the new installation.',
      selectItemsToMigrate: 'Select Items to Migrate',
      migrationOptional:
        "Migration is optional. If you don't have an existing installation, you can skip this step.",
      desktopAppSettings: 'Desktop App Settings',
      desktopAppSettingsDescription:
        'Configure how ComfyUI behaves on your desktop. You can change these settings later.',
      settings: {
        autoUpdate: 'Automatic Updates',
        allowMetrics: 'Usage Analytics',
        autoUpdateDescription:
          "Automatically download and install updates when they become available. You'll always be notified before updates are installed.",
        allowMetricsDescription:
          'Help improve ComfyUI by sending anonymous usage data. No personal information or workflow content will be collected.',
        learnMoreAboutData: 'Learn more about data collection',
        dataCollectionDialog: {
          title: 'About Data Collection',
          whatWeCollect: 'What we collect:',
          whatWeDoNotCollect: "What we don't collect:",
          errorReports: 'Error reports',
          systemInfo: 'Operating system and app version',
          personalInformation: 'Personal information',
          workflowContent: 'Workflow content',
          fileSystemInformation: 'File system information'
        }
      }
    },
    download: 'Download',
    loadAllFolders: 'Load All Folders',
    refresh: 'Refresh',
    terminal: 'Terminal',
    videoFailedToLoad: 'Video failed to load',
    extensionName: 'Extension Name',
    reloadToApplyChanges: 'Reload to apply changes',
    insert: 'Insert',
    systemInfo: 'System Info',
    devices: 'Devices',
    about: 'About',
    add: 'Add',
    confirm: 'Confirm',
    reset: 'Reset',
    resetKeybindingsTooltip: 'Reset keybindings to default',
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
    searchKeybindings: 'Search Keybindings',
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
      workflows: 'Workflows',
      browseTemplates: 'Browse example templates',
      openWorkflow: 'Open workflow in local file system',
      newBlankWorkflow: 'Create a new blank workflow',
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
      hideMenu: 'Hide Menu',
      showMenu: 'Show Menu',
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
      queueWorkflowFront: 'Queue workflow (Insert at Front)',
      queue: 'Queue',
      interrupt: 'Cancel current run',
      refresh: 'Refresh node definitions',
      clipspace: 'Open Clipspace',
      resetView: 'Reset canvas view',
      clear: 'Clear workflow',
      toggleBottomPanel: 'Toggle Bottom Panel'
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
      fitView: 'Fit View',
      selectMode: 'Select Mode',
      panMode: 'Pan Mode',
      toggleLinkVisibility: 'Toggle Link Visibility'
    },
    electronFileDownload: {
      pause: 'Pause Download',
      resume: 'Resume Download',
      cancel: 'Cancel Download'
    }
  },
  zh: {
    download: '下载',
    loadAllFolders: '加载所有文件夹',
    refresh: '刷新',
    terminal: '终端',
    videoFailedToLoad: '视频加载失败',
    extensionName: '扩展名称',
    reloadToApplyChanges: '重新加载以应用更改',
    insert: '插入',
    systemInfo: '系统信息',
    devices: '设备',
    about: '关于',
    add: '添加',
    confirm: '确认',
    reset: '重置',
    resetKeybindingsTooltip: '重置键位',
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
    experimental: 'BETA',
    deprecated: '弃用',
    loadWorkflow: '加载工作流',
    goToNode: '前往节点',
    settings: '设置',
    searchWorkflows: '搜索工作流',
    searchSettings: '搜索设置',
    searchNodes: '搜索节点',
    searchModels: '搜索模型',
    searchKeybindings: '搜索键位',
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
      openWorkflow: '在本地文件系统中打开工作流',
      newBlankWorkflow: '创建一个新空白工作流',
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
      hideMenu: '隐藏菜单',
      showMenu: '显示菜单',
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
      queueWorkflowFront: '执行工作流 (队列首)',
      queue: '队列',
      interrupt: '取消当前任务',
      refresh: '刷新节点',
      clipspace: '打开剪贴板',
      resetView: '重置画布视图',
      clear: '清空工作流',
      toggleBottomPanel: '底部面板'
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
      fitView: '适应视图',
      selectMode: '选择模式',
      panMode: '平移模式',
      toggleLinkVisibility: '切换链接可见性'
    }
  },
  ru: {
    download: 'Скачать',
    refresh: 'Обновить',
    loadAllFolders: 'Загрузить все папки',
    terminal: 'Терминал',
    videoFailedToLoad: 'Видео не удалось загрузить',
    extensionName: 'Название расширения',
    reloadToApplyChanges: 'Перезагрузите, чтобы применить изменения',
    insert: 'Вставить',
    systemInfo: 'Информация о системе',
    devices: 'Устройства',
    about: 'О',
    add: 'Добавить',
    confirm: 'Подтвердить',
    reset: 'Сбросить',
    resetKeybindingsTooltip: 'Сбросить сочетания клавиш по умолчанию',
    customizeFolder: 'Настроить папку',
    icon: 'Иконка',
    color: 'Цвет',
    bookmark: 'Закладка',
    folder: 'Папка',
    star: 'Звёздочка',
    heart: 'Сердце',
    file: 'Файл',
    inbox: 'Входящие',
    box: 'Ящик',
    briefcase: 'Чемодан',
    error: 'Ошибка',
    loading: 'Загрузка',
    findIssues: 'Найти Issue',
    copyToClipboard: 'Копировать в буфер обмена',
    openNewIssue: 'Открыть новый Issue',
    showReport: 'Показать отчёт',
    imageFailedToLoad: 'Изображение не удалось загрузить',
    reconnecting: 'Переподключение',
    reconnected: 'Переподключено',
    delete: 'Удалить',
    rename: 'Переименовать',
    customize: 'Настроить',
    experimental: 'БЕТА',
    deprecated: 'УСТАР',
    loadWorkflow: 'Загрузить рабочий процесс',
    goToNode: 'Перейти к узлу',
    settings: 'Настройки',
    searchWorkflows: 'Поиск рабочих процессов',
    searchSettings: 'Поиск настроек',
    searchNodes: 'Поиск узлов',
    searchModels: 'Поиск моделей',
    searchKeybindings: 'Поиск сочетаний клавиш',
    noResultsFound: 'Ничего не найдено',
    searchFailedMessage:
      'Не удалось найти ни одной настройки, соответствующей вашему запросу. Попробуйте скорректировать поисковый запрос.',
    noContent: '(Нет контента)',
    noTasksFound: 'Задачи не найдены',
    noTasksFoundMessage: 'В очереди нет задач.',
    newFolder: 'Новая папка',
    sideToolbar: {
      themeToggle: 'Переключить тему',
      queue: 'Очередь',
      nodeLibrary: 'Библиотека узлов',
      workflows: 'Рабочие процессы',
      browseTemplates: 'Просмотреть примеры шаблонов',
      openWorkflow: 'Открыть рабочий процесс в локальной файловой системе',
      newBlankWorkflow: 'Создайте новый пустой рабочий процесс',
      nodeLibraryTab: {
        sortOrder: 'Порядок сортировки'
      },
      modelLibrary: 'Библиотека моделей',
      queueTab: {
        showFlatList: 'Показать плоский список',
        backToAllTasks: 'Вернуться ко всем задачам',
        containImagePreview: 'Предпросмотр заливающего изображения',
        coverImagePreview: 'Предпросмотр подходящего изображения',
        clearPendingTasks: 'Очистить отложенные задачи'
      }
    },
    menu: {
      hideMenu: 'Скрыть меню',
      showMenu: 'Показать меню',
      batchCount: 'Количество пакетов',
      batchCountTooltip:
        'Количество раз, когда генерация рабочего процесса должна быть помещена в очередь',
      autoQueue: 'Автоочередь',
      disabled: 'Отключено',
      disabledTooltip:
        'Рабочий процесс не будет автоматически помещён в очередь',
      instant: 'Мгновенно',
      instantTooltip:
        'Рабочий процесс будет помещён в очередь сразу же после завершения генерации',
      change: 'При изменении',
      changeTooltip:
        'Рабочий процесс будет поставлен в очередь после внесения изменений',
      queueWorkflow: 'Очередь рабочего процесса',
      queueWorkflowFront: 'Очередь рабочего процесса (Вставка спереди)',
      queue: 'Очередь',
      interrupt: 'Отменить текущее выполнение',
      refresh: 'Обновить определения узлов',
      clipspace: 'Открыть Clipspace',
      resetView: 'Сбросить вид холста',
      clear: 'Очистить рабочий процесс'
    },
    templateWorkflows: {
      title: 'Начните работу с шаблона',
      template: {
        default: 'Image Generation',
        image2image: 'Image to Image',
        upscale: '2 Pass Upscale',
        flux_schnell: 'Flux Schnell'
      }
    },
    graphCanvasMenu: {
      zoomIn: 'Увеличить',
      zoomOut: 'Уменьшить',
      resetView: 'Сбросить вид',
      fitView: 'Подгонять под выделенные',
      selectMode: 'Выбрать режим',
      panMode: 'Режим панорамирования',
      toggleLinkVisibility: 'Переключить видимость ссылок'
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
