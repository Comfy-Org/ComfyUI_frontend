import type { ShallowRef } from 'vue'

import type { Positionable } from '@/lib/litegraph/src/interfaces'
import type { IContextMenuValue } from '@/lib/litegraph/src/types/contextMenu'
import type {
  LGraph,
  LGraphCanvas,
  LGraphNode,
  Vector2
} from '@/lib/litegraph/src/litegraph'
import type { MissingModelPipelineResult } from '@/platform/missingModel/types'
import type { MissingNodeType } from '@/platform/nodeReplacement/types'
import type { SettingParams } from '@/platform/settings/types'
import type {
  ComfyApiWorkflow,
  ComfyWorkflowJSON
} from '@/platform/workflow/validation/schemas/workflowSchema'
import type { Keybinding } from '@/platform/keybindings/types'
import type {
  ExecutionErrorWsMessage,
  NodeExecutionOutput,
  ProgressWsMessage
} from '@/platform/remote/comfyui/execution/types'
import type { NodeError } from '@/platform/remote/comfyui/types'
import type {
  WorkflowOpenSource,
  WorkflowQueueIntent
} from '@/platform/telemetry/types'
import type {
  ComfyWorkflow,
  LoadedComfyWorkflow
} from '@/platform/workflow/management/stores/comfyWorkflow'
import type { ComfyNodeDef, InputSpec } from '@/schemas/nodeDefSchema'
import type { ComfyApi } from '@/scripts/api'
import type { ComfyUI } from '@/scripts/ui'
import type { ComfyAppMenu } from '@/scripts/ui/menu/index'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { ComfyCommand } from '@/stores/commandStore'
import type { NodeExecutionId, NodeLocatorId } from '@/types/nodeIdentification'
import type { SerializedNodeId } from '@/types/nodeId'
import type { AuthUserInfo } from '@/types/authTypes'
import type {
  BottomPanelExtension,
  ExtensionManager
} from '@/types/extensionTypes'

export type ComfyWidgetConstructor = (
  node: LGraphNode,
  inputName: string,
  inputData: InputSpec,
  app: ComfyApp,
  widgetName?: string
) => { widget: IBaseWidget; minWidth?: number; minHeight?: number }

export type CustomComfyWidgetConstructor = (
  ...args: Parameters<ComfyWidgetConstructor>
) =>
  | {
      widget?: IBaseWidget
      minWidth?: number
      minHeight?: number
    }
  | IBaseWidget
  | undefined

type Widgets = Record<string, CustomComfyWidgetConstructor>

/**
 * Optional inputs to {@link ComfyApp.queuePrompt}. `intent` is telemetry
 * attribution only and never affects what gets executed.
 */
export interface QueuePromptOptions {
  queueNodeIds?: NodeExecutionId[]
  intent?: WorkflowQueueIntent
}

export interface LoadGraphDataOptions {
  checkForRerouteMigration?: boolean
  openSource?: WorkflowOpenSource
  shareId?: string
  deferWarnings?: boolean
  skipAssetScans?: boolean
  silentAssetErrors?: boolean
  workflowNavigationId?: number
}

/**
 * The public surface of the application singleton created in
 * `@/scripts/app`. Modules that the app itself imports reach the running
 * instance through `useApp()` from `@/scripts/appInstance`; only the
 * composition root imports the class.
 */
export interface ComfyApp {
  vueAppReady: boolean
  readonly api: ComfyApi
  readonly ui: ComfyUI
  extensionManager: ExtensionManager
  nodePreviewImages: Partial<Record<string, string[]>>
  nodeOutputs: Partial<Record<string, NodeExecutionOutput>>

  /** @deprecated Use {@link rootGraph} instead */
  readonly graph: LGraph
  readonly rootGraph: LGraph
  readonly rootGraphOrUndefined: LGraph | undefined
  /** Whether the root graph has been initialized. Safe to check without triggering error logs. */
  readonly isGraphReady: boolean

  /** The canvas, once {@link setup} has created it. Accessing it earlier is a bug. */
  canvas: LGraphCanvas
  /** Same as {@link canvas}, but `undefined` before {@link setup} creates it. */
  readonly canvasOrUndefined: LGraphCanvas | undefined
  readonly canvasElRef: ShallowRef<HTMLCanvasElement | undefined>
  readonly canvasEl: HTMLCanvasElement
  readonly configuringGraph: boolean
  ctx: CanvasRenderingContext2D
  dragOverNode: Pick<LGraphNode, 'onDragDrop' | 'id'> | null

  bodyTop: HTMLElement
  bodyLeft: HTMLElement
  bodyRight: HTMLElement
  bodyBottom: HTMLElement
  canvasContainer: HTMLElement
  readonly menu: ComfyAppMenu
  /** Set by the Comfy.Clipspace extension. */
  openClipspace: () => void

  /** @deprecated Use app.extensionManager.lastNodeErrors instead */
  readonly lastNodeErrors: Record<string, NodeError> | null
  /** @deprecated Use app.extensionManager.lastExecutionError instead */
  readonly lastExecutionError: ExecutionErrorWsMessage | null
  /** @deprecated Use useExecutionStore().executingNodeId instead */
  readonly runningNodeId: SerializedNodeId | null
  /** @deprecated Use useWorkspaceStore().shiftDown instead */
  readonly shiftDown: boolean
  /** @deprecated Use useWidgetStore().widgets instead */
  readonly widgets: Record<
    string,
    ComfyWidgetConstructor | CustomComfyWidgetConstructor
  >
  /** @deprecated storageLocation is always 'server' */
  readonly storageLocation: string
  /** @deprecated storage migration is no longer needed. */
  readonly isNewUserSession: boolean
  /** @deprecated Use useExtensionStore().extensions instead */
  readonly extensions: ComfyExtension[]
  /** @deprecated Use useExecutionStore().executingNodeProgress instead */
  readonly progress: ProgressWsMessage | null

  /** @deprecated Use useLitegraphService().resetView instead */
  resetView(): void
  getPreviewFormatParam(): string
  getRandParam(): string

  setup(canvasEl: HTMLCanvasElement): Promise<void>
  getNodeDefs(): Promise<Record<string, ComfyNodeDef>>
  registerNodes(): Promise<void>
  registerNodeDef(nodeId: string, nodeDef: ComfyNodeDef): Promise<void>
  registerNodesFromDefs(defs: Record<string, ComfyNodeDef>): Promise<void>
  loadTemplateData(templateData: {
    templates?: { name?: string; data?: string }[]
  }): void
  loadGraphData(
    graphData?: ComfyWorkflowJSON,
    clean?: boolean,
    restore_view?: boolean,
    workflow?: string | null | ComfyWorkflow,
    options?: LoadGraphDataOptions
  ): Promise<LoadedComfyWorkflow | boolean | undefined>
  refreshMissingModels(options?: {
    silent?: boolean
    reloadDefs?: boolean
  }): Promise<MissingModelPipelineResult>
  graphToPrompt(
    graph?: LGraph
  ): Promise<{ workflow: ComfyWorkflowJSON; output: ComfyApiWorkflow }>
  queuePrompt(
    number: number,
    batchCount?: number,
    options?: QueuePromptOptions
  ): Promise<boolean>
  queuePrompt(
    number: number,
    batchCount: number,
    queueNodeIds: NodeExecutionId[]
  ): Promise<boolean>
  showErrorOnFileLoad(file: File): void
  handleFile(
    file: File,
    openSource?: WorkflowOpenSource,
    options?: {
      deferWarnings?: boolean
      onNodeCreated?: (node: LGraphNode) => void
    }
  ): Promise<void>
  handleFileList(fileList: File[]): Promise<void>
  handleAudioFileList(fileList: File[]): Promise<void>
  handleVideoFileList(fileList: File[]): Promise<void>
  positionNodes(nodes: LGraphNode[]): void
  positionBatchNodes(nodes: LGraphNode[], batchNode: LGraphNode): void
  isApiJson(data: unknown): data is ComfyApiWorkflow
  loadApiJson(
    apiData: ComfyApiWorkflow,
    fileName: string,
    options?: { deferWarnings?: boolean }
  ): Promise<void>
  registerExtension(extension: ComfyExtension): void
  collectCanvasMenuItems(canvas: LGraphCanvas): IContextMenuValue[]
  collectNodeMenuItems(node: LGraphNode): IContextMenuValue[]
  reloadNodeDefs(): Promise<void>
  refreshComboInNodes(): Promise<void>
  clean(): void
  clientPosToCanvasPos(pos: Vector2): Vector2
  canvasPosToClientPos(pos: Vector2): Vector2
}

export interface AboutPageBadge {
  label: string
  url: string
  icon: string
  severity?: 'danger' | 'warn'
}

type MenuCommandGroup = {
  /**
   * The path to the menu group.
   */
  path: string[]
  /**
   * Command ids.
   * Note: Commands must be defined in `commands` array in the extension.
   */
  commands: string[]
}

export interface TopbarBadge {
  text: string
  /**
   * Optional badge label (e.g., "BETA", "ALPHA", "NEW")
   */
  label?: string
  /**
   * Visual variant for the badge
   * - info: Default informational badge (white label, gray background)
   * - warning: Warning badge (orange theme, higher emphasis)
   * - error: Error/alert badge (red theme, highest emphasis)
   */
  variant?: 'info' | 'warning' | 'error'
  /**
   * Optional icon class (e.g., "pi-exclamation-triangle")
   * If not provided, variant will determine the default icon
   */
  icon?: string
  /**
   * Optional tooltip text to show on hover
   */
  tooltip?: string
}

/*
 * Action bar button definition: add buttons to the action bar
 */
export interface ActionBarButton {
  /**
   * Icon class to display (e.g., "icon-[lucide--message-circle-question-mark]")
   */
  icon: string
  /**
   * Optional label text to display next to the icon
   */
  label?: string
  /**
   * Optional tooltip text to show on hover
   */
  tooltip?: string
  /**
   * Optional CSS classes to apply to the button
   */
  class?: string
  /**
   * Click handler for the button
   */
  onClick: () => void
}

export interface ComfyExtension {
  /**
   * The name of the extension
   */
  name: string
  /**
   * The commands defined by the extension
   */
  commands?: ComfyCommand[]
  /**
   * The keybindings defined by the extension
   */
  keybindings?: Keybinding[]
  /**
   * Menu commands to add to the menu bar
   */
  menuCommands?: MenuCommandGroup[]
  /**
   * Settings to add to the settings menu
   */
  settings?: SettingParams[]
  /**
   * Bottom panel tabs to add to the bottom panel
   */
  bottomPanelTabs?: BottomPanelExtension[]
  /**
   * Badges to add to the about page
   */
  aboutPageBadges?: AboutPageBadge[]
  /**
   * Badges to add to the top bar
   */
  topbarBadges?: TopbarBadge[]
  /**
   * Buttons to add to the action bar
   */
  actionBarButtons?: ActionBarButton[]
  /**
   * Allows any initialisation, e.g. loading resources. Called after the canvas is created but before nodes are added
   */
  init?(app: ComfyApp): Promise<void> | void
  /**
   * Allows any additional setup, called after the application is fully set up and running
   */
  setup?(app: ComfyApp): Promise<void> | void
  /**
   * Called before nodes are registered with the graph
   * @param defs The collection of node definitions, add custom ones or edit existing ones
   */
  addCustomNodeDefs?(
    defs: Record<string, ComfyNodeDef>,
    app: ComfyApp
  ): Promise<void> | void
  // TODO(huchenlei): We should deprecate the async return value of
  // getCustomWidgets.
  /**
   * Allows the extension to add custom widgets
   * @returns An array of {[widget name]: widget data}
   */
  getCustomWidgets?(app: ComfyApp): Promise<Widgets> | Widgets

  /**
   * Allows the extension to add additional commands to the selection toolbox
   * @param selectedItem The selected item on the canvas
   * @returns An array of command ids to add to the selection toolbox
   */
  getSelectionToolboxCommands?(selectedItem: Positionable): string[]

  /**
   * Allows the extension to add context menu items to canvas right-click menus
   * @param canvas The canvas instance
   * @returns An array of context menu items to add (null values represent separators)
   */
  getCanvasMenuItems?(canvas: LGraphCanvas): (IContextMenuValue | null)[]

  /**
   * Allows the extension to add context menu items to node right-click menus
   * @param node The node being right-clicked
   * @returns An array of context menu items to add (null values represent separators)
   */
  getNodeMenuItems?(node: LGraphNode): (IContextMenuValue | null)[]

  /**
   * Allows the extension to add additional handling to the node before it is registered with **LGraph**
   * @param nodeType The node class (not an instance)
   * @param nodeData The original node object info config object
   * @param app The app instance
   */
  beforeRegisterNodeDef?(
    nodeType: typeof LGraphNode,
    nodeData: ComfyNodeDef,
    app: ComfyApp
  ): Promise<void> | void

  /**
   * Allows the extension to modify the node definitions before they are used in the Vue app
   * Modifications is expected to be made in place.
   *
   * @param defs The node definitions
   * @param app The app instance
   */
  beforeRegisterVueAppNodeDefs?(defs: ComfyNodeDef[], app: ComfyApp): void

  /**
   * Allows the extension to register additional nodes with LGraph after standard nodes are added.
   * Custom node classes should extend **LGraphNode**.
   */
  registerCustomNodes?(app: ComfyApp): Promise<void> | void
  /**
   * Allows the extension to modify a node that has been reloaded onto the graph.
   * If you break something in the backend and want to patch workflows in the frontend
   * This is the place to do this
   * @param node The node that has been loaded
   * @param app The app instance
   */
  loadedGraphNode?(node: LGraphNode, app: ComfyApp): void
  /**
   * Allows the extension to run code after the constructor of the node
   * @param node The node that has been created
   * @param app The app instance
   */
  nodeCreated?(node: LGraphNode, app: ComfyApp): void

  beforeLoadGraph?(app: ComfyApp): Promise<void> | void

  afterLoadGraph?(app: ComfyApp): Promise<void> | void

  /**
   * Allows the extension to clean up state when graph configuration fails.
   * @param error The graph configuration error
   * @param app The app instance
   */
  onGraphLoadError?(error: unknown, app: ComfyApp): Promise<void> | void

  /**
   * Allows the extension to modify the graph data before it is configured.
   * @param graphData The graph data
   * @param missingNodeTypes The missing node types
   * @param app The app instance
   */
  beforeConfigureGraph?(
    graphData: ComfyWorkflowJSON,
    missingNodeTypes: MissingNodeType[],
    app: ComfyApp
  ): Promise<void> | void

  /**
   * Allows the extension to run code after the graph is configured.
   * @param missingNodeTypes The missing node types
   * @param app The app instance
   */
  afterConfigureGraph?(
    missingNodeTypes: MissingNodeType[],
    app: ComfyApp
  ): Promise<void> | void

  /**
   * Fired whenever authentication resolves, providing the anonymized user id..
   * Extensions can register at any time and will receive the latest value immediately.
   * This is an experimental API and may be changed or removed in the future.
   */
  onAuthUserResolved?(user: AuthUserInfo, app: ComfyApp): Promise<void> | void

  /**
   * Fired whenever the auth token is refreshed.
   * This is an experimental API and may be changed or removed in the future.
   */
  onAuthTokenRefreshed?(): Promise<void> | void

  /**
   * Fired when user logs out.
   * This is an experimental API and may be changed or removed in the future.
   */
  onAuthUserLogout?(): Promise<void> | void

  onNodeOutputsUpdated?(
    nodeOutputs: Partial<Record<NodeLocatorId, NodeExecutionOutput>>
  ): void

  [key: string]: unknown
}
