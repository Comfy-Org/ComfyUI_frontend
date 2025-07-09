import type { LGraphNode } from '@comfyorg/litegraph'

/**
 * V1 API node definition interface
 * This represents the current/legacy node definition format
 */
export interface ComfyNodeDefV1 {
  name: string
  display_name?: string
  description?: string
  category?: string
  output_node?: boolean
  input?: {
    required?: Record<string, any>
    optional?: Record<string, any>
    hidden?: Record<string, any>
  }
  output?: string[]
  output_is_list?: boolean[]
  output_name?: string[]
  output_tooltips?: string[]
  python_module?: string
  deprecated?: boolean
  experimental?: boolean
}

/**
 * V1 API extension interface
 */
export interface ComfyExtensionV1 {
  name: string
  apiVersion?: 'v1'

  // Lifecycle hooks
  init?(): void | Promise<void>
  setup?(): void | Promise<void>

  // Node lifecycle hooks
  beforeRegisterNodeDef?(
    nodeType: typeof LGraphNode,
    nodeData: ComfyNodeDefV1,
    app: ComfyAppV1
  ): void
  nodeCreated?(node: LGraphNode, app: ComfyAppV1): void

  // Graph hooks
  beforeConfigureGraph?(graphData: any, missingNodeTypes: any[]): void
  afterConfigureGraph?(missingNodeTypes: any[]): void

  // Canvas hooks
  getCustomWidgets?(): Record<string, any>

  // Menu hooks
  addCustomNodeDefs?(defs: ComfyNodeDefV1[]): ComfyNodeDefV1[]

  // Settings
  settings?: Array<{
    id: string
    name: string
    type: string
    defaultValue: any
    tooltip?: string
  }>

  // Commands
  commands?: Array<{
    id: string
    function: () => void | Promise<void>
  }>

  // Keybindings
  keybindings?: Array<{
    combo: { key: string; ctrl?: boolean; shift?: boolean; alt?: boolean }
    commandId: string
  }>
}

/**
 * V1 API ComfyApp interface
 * Provides the same interface as the current app
 */
export interface ComfyAppV1 {
  registerExtension(extension: ComfyExtensionV1): void

  // Graph management
  loadGraphData(graphData: any): Promise<void>
  clean(): void

  // Node management
  getNodeById(id: number): LGraphNode | null

  // Workflow operations
  queuePrompt(number: number, batchCount?: number): Promise<void>

  // Canvas operations
  canvas: any
  graph: any

  // UI state
  ui: any
}
