/**
 * V3 API node definition interface
 * Future schema-based node definition format
 */
export interface ComfyNodeDefV3 {
  name: string
  display_name?: string
  description?: string
  category?: string
  output_node?: boolean

  // JSON Schema-based definition
  schema: {
    type: 'object'
    properties: Record<string, any>
    required?: string[]
    additionalProperties?: boolean
  }

  // Structured input/output definitions
  inputs: Array<{
    name: string
    type: string
    required: boolean
    schema: any
    validation?: any
    tooltip?: string
    default?: any
    ui?: {
      widget?: string
      options?: any
    }
  }>

  outputs: Array<{
    name: string
    type: string
    is_list: boolean
    schema?: any
    tooltip?: string
  }>

  // Enhanced metadata
  metadata: {
    version: string
    author: string
    description: string
    tags: string[]
    documentation?: string
    repository?: string
    license?: string
    dependencies?: Array<{
      name: string
      version?: string
      optional?: boolean
    }>
  }

  // Execution information
  execution?: {
    async?: boolean
    gpu_memory?: number
    cpu_cores?: number
    timeout?: number
    retries?: number
  }

  python_module?: string
  deprecated?: boolean
  experimental?: boolean
}

/**
 * V3 API extension interface
 * Future extension format with enhanced capabilities
 */
export interface ComfyExtensionV3 {
  name: string
  apiVersion: 'v3'

  // Required metadata
  metadata: {
    version: string
    author: string
    description: string
    repository?: string
    license?: string
    dependencies?: Array<{
      name: string
      version?: string
      optional?: boolean
    }>
  }

  // Lifecycle hooks with enhanced data
  init?(): void | Promise<void>
  setup?(): void | Promise<void>
  beforeShutdown?(): void | Promise<void>

  // Node lifecycle hooks
  beforeRegisterNodeDef?(
    nodeType: any,
    nodeData: ComfyNodeDefV3,
    app: ComfyAppV3
  ): void | Promise<void>
  afterRegisterNodeDef?(
    nodeType: any,
    nodeData: ComfyNodeDefV3,
    app: ComfyAppV3
  ): void | Promise<void>
  nodeCreated?(node: any, app: ComfyAppV3): void | Promise<void>
  nodeRemoved?(node: any, app: ComfyAppV3): void | Promise<void>

  // Graph hooks
  beforeConfigureGraph?(
    graphData: any,
    missingNodeTypes: any[]
  ): void | Promise<void>
  afterConfigureGraph?(missingNodeTypes: any[]): void | Promise<void>
  graphChanged?(graph: any): void | Promise<void>

  // Enhanced settings with full schema validation
  settings?: Array<{
    id: string
    name: string
    schema: any
    defaultValue: any
    tooltip?: string
    category?: string
    validation?: (value: any) => boolean | string
    ui?: {
      widget?: string
      options?: any
    }
  }>

  // Enhanced commands with full metadata
  commands?: Array<{
    id: string
    function: () => void | Promise<void>
    metadata: {
      label: string
      tooltip?: string
      category?: string
      icon?: string
      shortcut?: string
    }
    validation?: () => boolean
  }>

  // Keybindings with enhanced options
  keybindings?: Array<{
    combo: {
      key: string
      ctrl?: boolean
      shift?: boolean
      alt?: boolean
      meta?: boolean
    }
    commandId: string
    when?: string // Context condition
    priority?: number
  }>

  // UI extensions
  uiExtensions?: {
    bottomPanelTabs?: Array<{
      id: string
      title: string
      icon: string
      component: any
      tooltip?: string
      when?: string
    }>

    contextMenus?: Array<{
      id: string
      items: Array<{
        id: string
        label: string
        commandId: string
        when?: string
        separator?: boolean
      }>
    }>

    toolbars?: Array<{
      id: string
      location: 'top' | 'bottom' | 'left' | 'right'
      items: Array<{
        id: string
        type: 'button' | 'separator' | 'dropdown'
        commandId?: string
        label?: string
        icon?: string
        tooltip?: string
      }>
    }>
  }

  // API endpoints (for extensions that provide their own APIs)
  apiEndpoints?: Array<{
    path: string
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
    handler: (req: any, res: any) => void | Promise<void>
    schema?: any
    auth?: boolean
  }>
}

/**
 * V3 API ComfyApp interface
 * Future app interface with enhanced capabilities
 */
export interface ComfyAppV3 {
  registerExtension(extension: ComfyExtensionV3): Promise<void>

  // Enhanced graph management
  graph: {
    load(data: any): Promise<void>
    save(): any
    clear(): void
    validate(): Promise<boolean>
    getNodes(): any[]
    getNodeById(id: string): any | null
    addNode(type: string, options?: any): Promise<any>
    removeNode(node: any): Promise<void>
    connectNodes(source: any, target: any, options?: any): Promise<void>
    disconnectNodes(source: any, target: any): Promise<void>
  }

  // Enhanced workflow operations
  workflow: {
    queue(batchCount?: number): Promise<string>
    cancel(executionId?: string): Promise<void>
    pause(): Promise<void>
    resume(): Promise<void>
    getStatus(): any
    getHistory(): any[]
    getQueue(): any[]
  }

  // Settings management
  settings: {
    get<T = any>(id: string): T
    set(id: string, value: any): Promise<void>
    getAll(): Record<string, any>
    reset(id?: string): Promise<void>
    export(): any
    import(data: any): Promise<void>
  }

  // Command system
  commands: {
    execute(id: string, args?: any): Promise<any>
    register(command: any): void
    unregister(id: string): void
    getAll(): any[]
    isAvailable(id: string): boolean
  }

  // UI management
  ui: {
    bottomPanel: any
    sidebar: any
    menu: any
    canvas: any
    dialogs: any
    notifications: any
  }

  // Event system
  events: {
    on<T = unknown>(event: string, handler: (data: T) => void): void
    off<T = unknown>(event: string, handler?: (data: T) => void): void
    emit<T = unknown>(event: string, data?: T): void
    once<T = unknown>(event: string, handler: (data: T) => void): void
  }

  // API access
  api: {
    get(path: string, options?: any): Promise<any>
    post(path: string, data?: any, options?: any): Promise<any>
    put(path: string, data?: any, options?: any): Promise<any>
    delete(path: string, options?: any): Promise<any>
    patch(path: string, data?: any, options?: any): Promise<any>
  }
}
