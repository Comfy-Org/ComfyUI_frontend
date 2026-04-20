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
    missingModelImportUnsupported: 'missing-model-import-unsupported',
    missingMediaGroup: 'error-group-missing-media',
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
  topbar: {
    queueButton: 'queue-button',
    queueModeMenuTrigger: 'queue-mode-menu-trigger',
    saveButton: 'save-workflow-button',
    subscribeButton: 'topbar-subscribe-button'
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
    subgraph: 'subgraph-breadcrumb'
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
    clearHistoryAction: 'clear-history-action'
  },
  errors: {
    imageLoadError: 'error-loading-image',
    videoLoadError: 'error-loading-video'
  },
  loading: {
    overlay: 'loading-overlay'
  },
  load3dViewer: {
    sidebar: 'load3d-viewer-sidebar'
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
  }
} as const

/**
 * Helper type for accessing nested TestIds (excludes function values)
 */
export type TestIdValue =
  | (typeof TestIds.sidebar)[keyof typeof TestIds.sidebar]
  | (typeof TestIds.tree)[keyof typeof TestIds.tree]
  | (typeof TestIds.canvas)[keyof typeof TestIds.canvas]
  | (typeof TestIds.dialogs)[keyof typeof TestIds.dialogs]
  | (typeof TestIds.keybindings)[keyof typeof TestIds.keybindings]
  | (typeof TestIds.topbar)[keyof typeof TestIds.topbar]
  | (typeof TestIds.nodeLibrary)[keyof typeof TestIds.nodeLibrary]
  | (typeof TestIds.propertiesPanel)[keyof typeof TestIds.propertiesPanel]
  | (typeof TestIds.node)[keyof typeof TestIds.node]
  | (typeof TestIds.selectionToolbox)[keyof typeof TestIds.selectionToolbox]
  | (typeof TestIds.widgets)[keyof typeof TestIds.widgets]
  | (typeof TestIds.builder)[keyof typeof TestIds.builder]
  | (typeof TestIds.outputHistory)[keyof typeof TestIds.outputHistory]
  | (typeof TestIds.appMode)[keyof typeof TestIds.appMode]
  | (typeof TestIds.breadcrumb)[keyof typeof TestIds.breadcrumb]
  | Exclude<
      (typeof TestIds.templates)[keyof typeof TestIds.templates],
      (id: string) => string
    >
  | (typeof TestIds.user)[keyof typeof TestIds.user]
  | (typeof TestIds.menu)[keyof typeof TestIds.menu]
  | (typeof TestIds.subgraphEditor)[keyof typeof TestIds.subgraphEditor]
  | (typeof TestIds.queue)[keyof typeof TestIds.queue]
  | (typeof TestIds.errors)[keyof typeof TestIds.errors]
  | (typeof TestIds.loading)[keyof typeof TestIds.loading]
  | (typeof TestIds.load3dViewer)[keyof typeof TestIds.load3dViewer]
  | (typeof TestIds.imageCompare)[keyof typeof TestIds.imageCompare]
