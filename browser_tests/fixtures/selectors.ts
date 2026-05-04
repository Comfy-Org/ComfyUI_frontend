/**
 * Centralized test selectors for browser tests.
 * Use data-testid attributes for stable selectors.
 */

export const TestIds = {
  sidebar: {
    toolbar: 'side-toolbar',
    nodeLibrary: 'node-library-tree',
    nodeLibrarySearch: 'node-library-search',
    workflows: 'workflows-sidebar',
    modeToggle: 'mode-toggle'
  },
  tree: {
    folder: 'tree-folder',
    leaf: 'tree-leaf',
    node: 'tree-node'
  },
  canvas: {
    main: 'graph-canvas',
    contextMenu: 'canvas-context-menu',
    toggleMinimapButton: 'toggle-minimap-button',
    closeMinimapButton: 'close-minimap-button',
    minimapContainer: 'minimap-container',
    minimapCanvas: 'minimap-canvas',
    minimapViewport: 'minimap-viewport',
    minimapInteractionOverlay: 'minimap-interaction-overlay',
    toggleLinkVisibilityButton: 'toggle-link-visibility-button',
    zoomControlsButton: 'zoom-controls-button',
    zoomInAction: 'zoom-in-action',
    zoomOutAction: 'zoom-out-action',
    zoomToFitAction: 'zoom-to-fit-action',
    zoomPercentageInput: 'zoom-percentage-input'
  },
  dialogs: {
    settings: 'settings-dialog',
    settingsContainer: 'settings-container',
    settingsTabAbout: 'settings-tab-about',
    confirm: 'confirm-dialog',
    errorOverlay: 'error-overlay',
    errorOverlaySeeErrors: 'error-overlay-see-errors',
    errorOverlayDismiss: 'error-overlay-dismiss',
    errorOverlayMessages: 'error-overlay-messages',
    runtimeErrorPanel: 'runtime-error-panel',
    missingNodeCard: 'missing-node-card',
    errorCardFindOnGithub: 'error-card-find-on-github',
    errorCardCopy: 'error-card-copy',
    errorDialog: 'error-dialog',
    errorDialogShowReport: 'error-dialog-show-report',
    errorDialogContactSupport: 'error-dialog-contact-support',
    errorDialogCopyReport: 'error-dialog-copy-report',
    errorDialogFindIssues: 'error-dialog-find-issues',
    about: 'about-panel',
    whatsNewSection: 'whats-new-section',
    missingNodePacksGroup: 'error-group-missing-node',
    missingModelsGroup: 'error-group-missing-model',
    missingModelExpand: 'missing-model-expand',
    missingModelLocate: 'missing-model-locate',
    missingModelCopyName: 'missing-model-copy-name',
    missingModelCopyUrl: 'missing-model-copy-url',
    missingModelDownload: 'missing-model-download',
    missingModelActions: 'missing-model-actions',
    missingModelDownloadAll: 'missing-model-download-all',
    missingModelRefresh: 'missing-model-refresh',
    missingModelImportUnsupported: 'missing-model-import-unsupported',
    missingMediaGroup: 'error-group-missing-media',
    swapNodesGroup: 'error-group-swap-nodes',
    missingMediaRow: 'missing-media-row',
    missingMediaUploadDropzone: 'missing-media-upload-dropzone',
    missingMediaLibrarySelect: 'missing-media-library-select',
    missingMediaStatusCard: 'missing-media-status-card',
    missingMediaConfirmButton: 'missing-media-confirm-button',
    missingMediaCancelButton: 'missing-media-cancel-button',
    missingMediaLocateButton: 'missing-media-locate-button',
    publishTabPanel: 'publish-tab-panel',
    apiSignin: 'api-signin-dialog',
    updatePassword: 'update-password-dialog',
    cloudNotification: 'cloud-notification-dialog'
  },
  keybindings: {
    presetMenu: 'keybinding-preset-menu'
  },
  nodeTemplates: {
    manageDialog: 'manage-node-templates-dialog'
  },
  topbar: {
    queueButton: 'queue-button',
    queueModeMenuTrigger: 'queue-mode-menu-trigger',
    saveButton: 'save-workflow-button',
    subscribeButton: 'topbar-subscribe-button',
    loginButton: 'login-button',
    loginButtonPopover: 'login-button-popover',
    loginButtonPopoverLearnMore: 'login-button-popover-learn-more',
    actionBarButtons: 'action-bar-buttons'
  },
  nodeLibrary: {
    bookmarksSection: 'node-library-bookmarks-section'
  },
  propertiesPanel: {
    root: 'properties-panel',
    errorsTab: 'panel-tab-errors'
  },
  subgraphEditor: {
    toggle: 'subgraph-editor-toggle',
    shownSection: 'subgraph-editor-shown-section',
    hiddenSection: 'subgraph-editor-hidden-section',
    widgetToggle: 'subgraph-widget-toggle',
    widgetLabel: 'subgraph-widget-label',
    iconLink: 'icon-link',
    iconEye: 'icon-eye',
    widgetActionsMenuButton: 'widget-actions-menu-button'
  },
  node: {
    titleInput: 'node-title-input',
    pinIndicator: 'node-pin-indicator',
    innerWrapper: 'node-inner-wrapper',
    mainImage: 'main-image'
  },
  selectionToolbox: {
    root: 'selection-toolbox',
    colorPickerButton: 'color-picker-button',
    colorPickerCurrentColor: 'color-picker-current-color',
    colorBlue: 'blue',
    colorRed: 'red'
  },
  menu: {
    moreMenuContent: 'more-menu-content'
  },
  helpCenter: {
    button: 'help-center-button',
    popup: 'help-center-popup',
    backdrop: 'help-center-backdrop',
    menuItem: (key: string) => `help-menu-item-${key}`,
    releaseItem: (version: string) => `help-release-item-${version}`
  },
  widgets: {
    container: 'node-widgets',
    widget: 'node-widget',
    decrement: 'decrement',
    increment: 'increment',
    domWidgetTextarea: 'dom-widget-textarea',
    subgraphEnterButton: 'subgraph-enter-button'
  },
  builder: {
    footerNav: 'builder-footer-nav',
    saveButton: 'builder-save-button',
    saveAsButton: 'builder-save-as-button',
    saveGroup: 'builder-save-group',
    saveAsChevron: 'builder-save-as-chevron',
    ioItem: 'builder-io-item',
    ioItemTitle: 'builder-io-item-title',
    ioItemSubtitle: 'builder-io-item-subtitle',
    widgetActionsMenu: 'widget-actions-menu',
    opensAs: 'builder-opens-as',
    widgetItem: 'builder-widget-item',
    widgetLabel: 'builder-widget-label',
    outputPlaceholder: 'builder-output-placeholder',
    connectOutputPopover: 'builder-connect-output-popover',
    connectOutputSwitch: 'builder-connect-output-switch',
    emptyWorkflowDialog: 'builder-empty-workflow-dialog',
    emptyWorkflowBack: 'builder-empty-workflow-back',
    emptyWorkflowLoadTemplate: 'builder-empty-workflow-load-template'
  },
  outputHistory: {
    outputs: 'linear-outputs',
    welcome: 'linear-welcome',
    outputInfo: 'linear-output-info',
    activeQueue: 'linear-job',
    queueBadge: 'linear-job-badge',
    inProgressItem: 'linear-in-progress-item',
    historyItem: 'linear-history-item',
    skeleton: 'linear-skeleton',
    latentPreview: 'linear-latent-preview',
    imageOutput: 'linear-image-output',
    videoOutput: 'linear-video-output',
    cancelRun: 'linear-cancel-run',
    headerProgressBar: 'linear-header-progress-bar',
    itemProgressBar: 'linear-item-progress-bar',
    progressOverall: 'linear-progress-overall',
    progressNode: 'linear-progress-node'
  },
  appMode: {
    widgetItem: 'app-mode-widget-item',
    welcome: 'linear-welcome',
    emptyWorkflow: 'linear-welcome-empty-workflow',
    buildApp: 'linear-welcome-build-app',
    backToWorkflow: 'linear-welcome-back-to-workflow',
    loadTemplate: 'linear-welcome-load-template',
    arrangePreview: 'linear-arrange-preview',
    arrangeNoOutputs: 'linear-arrange-no-outputs',
    arrangeSwitchToOutputs: 'linear-arrange-switch-to-outputs',
    vueNodeSwitchPopup: 'linear-vue-node-switch-popup',
    vueNodeSwitchDismiss: 'linear-vue-node-switch-dismiss',
    vueNodeSwitchDontShowAgain: 'linear-vue-node-switch-dont-show-again'
  },
  breadcrumb: {
    subgraph: 'subgraph-breadcrumb',
    back: 'subgraph-breadcrumb-back',
    item: (key: string) => `subgraph-breadcrumb-item-${key}`,
    blueprintTag: 'subgraph-breadcrumb-blueprint-tag',
    missingNodesIcon: 'subgraph-breadcrumb-missing-nodes-icon',
    renameInput: 'subgraph-breadcrumb-rename-input',
    menu: (key: string) => `subgraph-breadcrumb-menu-${key}`
  },
  templates: {
    content: 'template-workflows-content',
    workflowCard: (id: string) => `template-workflow-${id}`
  },
  user: {
    currentUserIndicator: 'current-user-indicator'
  },
  queue: {
    overlayToggle: 'queue-overlay-toggle',
    clearHistoryAction: 'clear-history-action',
    jobAssetsList: 'job-assets-list',
    notificationBanner: 'queue-notification-banner'
  },
  errors: {
    imageLoadError: 'error-loading-image',
    videoLoadError: 'error-loading-video'
  },
  publish: {
    dialog: 'publish-dialog',
    savePrompt: 'publish-save-prompt',
    describeStep: 'publish-describe-step',
    finishStep: 'publish-finish-step',
    footer: 'publish-footer',
    profilePrompt: 'publish-profile-prompt',
    nav: 'publish-nav',
    gateFlow: 'publish-gate-flow',
    nameInput: 'publish-name-input',
    tagsInput: 'publish-tags-input'
  },
  loading: {
    overlay: 'loading-overlay'
  },
  load3d: {
    recordingDuration: 'load3d-recording-duration'
  },
  load3dViewer: {
    sidebar: 'load3d-viewer-sidebar'
  },
  terminal: {
    root: 'terminal-root',
    host: 'terminal-host',
    copyButton: 'terminal-copy-button',
    errorMessage: 'terminal-error-message',
    loadingSpinner: 'terminal-loading-spinner'
  },
  imageCompare: {
    viewport: 'image-compare-viewport',
    empty: 'image-compare-empty',
    batchNav: 'batch-nav',
    beforeBatch: 'before-batch',
    afterBatch: 'after-batch',
    batchCounter: 'batch-counter',
    batchNext: 'batch-next',
    batchPrev: 'batch-prev'
  },
  searchBoxV2: {
    resultItem: 'result-item',
    filterOption: 'filter-option',
    filterChip: 'filter-chip',
    chipDelete: 'chip-delete',
    noResults: 'no-results',
    nodeIdBadge: 'node-id-badge',
    sidebarToggle: 'toggle-category-sidebar',
    sidebarBackdrop: 'sidebar-backdrop',
    filterChipsScroll: 'filter-chips-scroll',
    category: (id: string) => `category-${id}`,
    rootCategory: (id: string) => `search-category-${id}`,
    typeFilter: (key: 'input' | 'output') => `search-filter-${key}`
  }
} as const

export type TestId<K extends keyof typeof TestIds> = Exclude<
  (typeof TestIds)[K][keyof (typeof TestIds)[K]],
  (...args: never[]) => string
>

export type TestIdValue = {
  [K in keyof typeof TestIds]: TestId<K>
}[keyof typeof TestIds]
