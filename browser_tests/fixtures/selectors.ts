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
    toggleLinkVisibilityButton: 'toggle-link-visibility-button'
  },
  dialogs: {
    settings: 'settings-dialog',
    settingsContainer: 'settings-container',
    settingsTabAbout: 'settings-tab-about',
    confirm: 'confirm-dialog',
    about: 'about-panel',
    whatsNewSection: 'whats-new-section'
  },
  topbar: {
    queueButton: 'queue-button',
    saveButton: 'save-workflow-button'
  },
  nodeLibrary: {
    bookmarksSection: 'node-library-bookmarks-section'
  },
  propertiesPanel: {
    root: 'properties-panel'
  },
  node: {
    titleInput: 'node-title-input'
  },
  widgets: {
    decrement: 'decrement',
    increment: 'increment',
    subgraphEnterButton: 'subgraph-enter-button'
  },
  templates: {
    content: 'template-workflows-content',
    workflowCard: (id: string) => `template-workflow-${id}`
  },
  user: {
    currentUserIndicator: 'current-user-indicator'
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
  | (typeof TestIds.topbar)[keyof typeof TestIds.topbar]
  | (typeof TestIds.nodeLibrary)[keyof typeof TestIds.nodeLibrary]
  | (typeof TestIds.propertiesPanel)[keyof typeof TestIds.propertiesPanel]
  | (typeof TestIds.node)[keyof typeof TestIds.node]
  | (typeof TestIds.widgets)[keyof typeof TestIds.widgets]
  | Exclude<
      (typeof TestIds.templates)[keyof typeof TestIds.templates],
      (id: string) => string
    >
  | (typeof TestIds.user)[keyof typeof TestIds.user]
