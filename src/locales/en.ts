export default {
  welcome: {
    title: 'Welcome to ComfyUI',
    getStarted: 'Get Started'
  },
  userSelect: {
    newUser: 'New user',
    enterUsername: 'Enter a username',
    existingUser: 'Existing user',
    selectUser: 'Select a user',
    next: 'Next'
  },
  notSupported: {
    title: 'Your device is not supported',
    message: 'Only following devices are supported:',
    learnMore: 'Learn More',
    reportIssue: 'Report Issue',
    supportedDevices: {
      macos: 'MacOS (M1 or later)',
      windows: 'Windows (Nvidia GPU with CUDA support)'
    }
  },
  downloadGit: {
    title: 'Download git',
    message:
      'Unable to locate git.  A working copy of git is required for normal operation.',
    instructions:
      'Please download and install the latest version for your operating system.  The Download git button below opens the git-scm.com downloads page.',
    warning:
      'If you are sure you do not need git installed, or there has been a mistake, you may click Skip to byapss this check.  Attempting to run ComfyUI without a working copy of git is not currently supported.',
    gitWebsite: 'Download git',
    skip: 'Skip'
  },
  install: {
    installLocation: 'Install Location',
    migration: 'Migration',
    desktopSettings: 'Desktop Settings',
    chooseInstallationLocation: 'Choose Installation Location',
    systemLocations: 'System Locations',
    failedToSelectDirectory: 'Failed to select directory',
    pathValidationFailed: 'Failed to validate path',
    installLocationDescription:
      "Select the directory for ComfyUI's user data. A python environment will be installed to the selected location. Please make sure the selected disk has enough space (~15GB) left.",
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
      allowMetrics: 'Crash Reports',
      autoUpdateDescription:
        "Automatically download and install updates when they become available. You'll always be notified before updates are installed.",
      allowMetricsDescription:
        'Help improve ComfyUI by sending anonymous crash reports. No personal information or workflow content will be collected. This can be disabled at any time in the settings menu.',
      learnMoreAboutData: 'Learn more about data collection',
      dataCollectionDialog: {
        title: 'About Data Collection',
        whatWeCollect: 'What we collect:',
        whatWeDoNotCollect: "What we don't collect:",
        errorReports: 'Error message and stack trace',
        systemInfo: 'Hardware, OS type, and app version',
        personalInformation: 'Personal information',
        workflowContent: 'Workflow content',
        fileSystemInformation: 'File system information',
        workflowContents: 'Workflow contents',
        customNodeConfigurations: 'Custom node configurations'
      }
    },
    customNodes: 'Custom Nodes',
    customNodesDescription:
      'Reference custom node files from existing ComfyUI installations and install their dependencies.'
  },
  serverStart: {
    reinstall: 'Reinstall',
    reportIssue: 'Report Issue',
    openLogs: 'Open Logs',
    process: {
      'initial-state': 'Loading...',
      'python-setup': 'Setting up Python Environment...',
      'starting-server': 'Starting ComfyUI server...',
      ready: 'Finishing...',
      error: 'Unable to start ComfyUI Desktop'
    }
  },
  serverConfig: {
    modifiedConfigs:
      'You have modified the following server configurations. Restart to apply changes.',
    revertChanges: 'Revert Changes',
    restart: 'Restart'
  },
  currentUser: 'Current user',
  empty: 'Empty',
  noWorkflowsFound: 'No workflows found.',
  comingSoon: 'Coming Soon',
  firstTimeUIMessage:
    'This is the first time you use the new UI. Choose "Menu > Use New Menu > Disabled" to restore the old UI.',
  download: 'Download',
  loadAllFolders: 'Load All Folders',
  refresh: 'Refresh',
  terminal: 'Terminal',
  logs: 'Logs',
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
  reportIssue: 'Send Report',
  reportIssueTooltip: 'Submit the error report to Comfy Org',
  reportSent: 'Report Submitted',
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
  searchExtensions: 'Search Extensions',
  noResultsFound: 'No Results Found',
  searchFailedMessage:
    "We couldn't find any settings matching your search. Try adjusting your search terms.",
  noTasksFound: 'No Tasks Found',
  noTasksFoundMessage: 'There are no tasks in the queue.',
  newFolder: 'New Folder',
  sideToolbar: {
    themeToggle: 'Toggle Theme',
    logout: 'Logout',
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
    downloads: 'Downloads',
    queueTab: {
      showFlatList: 'Show Flat List',
      backToAllTasks: 'Back to All Tasks',
      containImagePreview: 'Fill Image Preview',
      coverImagePreview: 'Fit Image Preview',
      clearPendingTasks: 'Clear Pending Tasks',
      filter: 'Filter Outputs',
      filters: {
        hideCached: 'Hide Cached',
        hideCanceled: 'Hide Canceled'
      }
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
    queueWorkflow: 'Queue workflow (Shift to queue at front)',
    queueWorkflowFront: 'Queue workflow at front',
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
    inProgress: 'In Progress',
    pause: 'Pause Download',
    paused: 'Paused',
    resume: 'Resume Download',
    cancel: 'Cancel Download',
    cancelled: 'Cancelled'
  }
}
