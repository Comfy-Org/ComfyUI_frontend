import type { ComfyAppV1, ComfyExtensionV1, ComfyNodeDefV1 } from './v1'

/**
 * V1.2 API node definition interface
 * Extends V1 with additional structured input information
 */
export interface ComfyNodeDefV1_2 extends ComfyNodeDefV1 {
  inputs?: Array<{
    name: string
    type: string
    required: boolean
    options?: any
    spec?: any
    tooltip?: string
    default?: any
  }>

  metadata?: {
    version?: string
    author?: string
    description?: string
    tags?: string[]
    documentation?: string
  }

  // Enhanced output information
  outputs?: Array<{
    name: string
    type: string
    is_list: boolean
    tooltip?: string
  }>
}

/**
 * V1.2 API extension interface
 * Extends V1 with additional capabilities
 */
export interface ComfyExtensionV1_2 extends ComfyExtensionV1 {
  apiVersion?: 'v1_2'

  // V1.2 specific hooks
  beforeRegisterNodeDef?(
    nodeType: any,
    nodeData: ComfyNodeDefV1_2,
    app: ComfyAppV1_2
  ): void
  nodeCreated?(node: any, app: ComfyAppV1_2): void

  // Enhanced settings with validation
  settings?: Array<{
    id: string
    name: string
    type: string
    defaultValue: any
    tooltip?: string
    validation?: (value: any) => boolean | string
    category?: string
    options?: any[]
  }>

  // Enhanced commands with descriptions
  commands?: Array<{
    id: string
    function: () => void | Promise<void>
    label?: string
    tooltip?: string
    category?: string
    icon?: string
  }>

  // Bottom panel tabs
  bottomPanelTabs?: Array<{
    id: string
    title: string
    icon: string
    type: 'vue' | 'custom'
    component?: any
    tooltip?: string
  }>

  // Menu items
  menuItems?: Array<{
    path: string[]
    commands: string[]
  }>
}

/**
 * V1.2 API ComfyApp interface
 * Extends V1 with additional functionality
 */
export interface ComfyAppV1_2 extends ComfyAppV1 {
  registerExtension(extension: ComfyExtensionV1_2): void

  // Enhanced node operations
  createNode(type: string, title?: string, options?: any): any
  removeNode(node: any): void

  // Settings operations
  getSetting(id: string): any
  setSetting(id: string, value: any): void

  // Command operations
  executeCommand(id: string): Promise<void>

  // Enhanced UI access
  bottomPanel: any
  sidebar: any
  menu: any
}
