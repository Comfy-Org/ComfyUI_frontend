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
    themeToggle: 'theme-toggle'
  },
  tree: {
    folder: 'tree-folder',
    leaf: 'tree-leaf',
    node: 'tree-node'
  },
  canvas: {
    main: 'graph-canvas',
    contextMenu: 'canvas-context-menu'
  },
  dialogs: {
    settings: 'settings-dialog',
    settingsContainer: 'settings-container',
    confirm: 'confirm-dialog',
    about: 'about-panel'
  },
  topbar: {
    queueButton: 'queue-button',
    saveButton: 'save-workflow-button'
  },
  nodeLibrary: {
    bookmarksSection: 'node-library-bookmarks-section'
  }
} as const

/**
 * Helper type for accessing nested TestIds
 */
export type TestIdValue =
  | (typeof TestIds.sidebar)[keyof typeof TestIds.sidebar]
  | (typeof TestIds.tree)[keyof typeof TestIds.tree]
  | (typeof TestIds.canvas)[keyof typeof TestIds.canvas]
  | (typeof TestIds.dialogs)[keyof typeof TestIds.dialogs]
  | (typeof TestIds.topbar)[keyof typeof TestIds.topbar]
  | (typeof TestIds.nodeLibrary)[keyof typeof TestIds.nodeLibrary]
