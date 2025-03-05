import { Component } from 'vue'

export interface MenuPaneDefinition {
  /**
   * Unique identifier for the menu pane
   */
  id: string
  /**
   * Display name shown in the tab
   */
  title: string
  /**
   * Icon to display in the tab
   */
  icon?: string
  /**
   * The Vue component to render as the pane content
   */
  component: Component
  /**
   * Optional props to pass to the component
   */
  props?: Record<string, any>
}

export interface RegisteredMenuPane extends MenuPaneDefinition {
  /**
   * Whether this pane is currently visible in the UI
   */
  visible: boolean
  /**
   * Path used for tab identification (similar to workflow paths)
   * @example "menu-pane://{id}"
   */
  path: string
}
