import { LGraphNode, IWidget } from './litegraph'
import { ComfyApp } from '../scripts/app'
import type { ComfyNodeDef } from '@/types/apiTypes'
import type { Keybinding } from '@/types/keyBindingTypes'
import type { ComfyCommand } from '@/stores/commandStore'

export type Widgets = Record<
  string,
  (
    node,
    inputName,
    inputData,
    app?: ComfyApp
  ) => { widget?: IWidget; minWidth?: number; minHeight?: number }
>

export type MenuCommandGroup = {
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
   * Allows any initialisation, e.g. loading resources. Called after the canvas is created but before nodes are added
   * @param app The ComfyUI app instance
   */
  init?(app: ComfyApp): Promise<void> | void
  /**
   * Allows any additional setup, called after the application is fully set up and running
   * @param app The ComfyUI app instance
   */
  setup?(app: ComfyApp): Promise<void> | void
  /**
   * Called before nodes are registered with the graph
   * @param defs The collection of node definitions, add custom ones or edit existing ones
   * @param app The ComfyUI app instance
   */
  addCustomNodeDefs?(
    defs: Record<string, ComfyNodeDef>,
    app: ComfyApp
  ): Promise<void> | void
  /**
   * Allows the extension to add custom widgets
   * @param app The ComfyUI app instance
   * @returns An array of {[widget name]: widget data}
   */
  getCustomWidgets?(app: ComfyApp): Promise<Widgets> | Widgets
  /**
   * Allows the extension to add additional handling to the node before it is registered with **LGraph**
   * @param nodeType The node class (not an instance)
   * @param nodeData The original node object info config object
   * @param app The ComfyUI app instance
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
   * @param app The ComfyUI app instance
   */
  beforeRegisterVueAppNodeDefs?(defs: ComfyNodeDef[], app: ComfyApp): void

  /**
   * Allows the extension to register additional nodes with LGraph after standard nodes are added.
   * Custom node classes should extend **LGraphNode**.
   *
   * @param app The ComfyUI app instance
   */
  registerCustomNodes?(app: ComfyApp): Promise<void> | void
  /**
   * Allows the extension to modify a node that has been reloaded onto the graph.
   * If you break something in the backend and want to patch workflows in the frontend
   * This is the place to do this
   * @param node The node that has been loaded
   * @param app The ComfyUI app instance
   */
  loadedGraphNode?(node: LGraphNode, app: ComfyApp): void
  /**
   * Allows the extension to run code after the constructor of the node
   * @param node The node that has been created
   * @param app The ComfyUI app instance
   */
  nodeCreated?(node: LGraphNode, app: ComfyApp): void

  [key: string]: any
}

/**
 * @deprecated Use ComfyNodeDef instead
 */
export type ComfyObjectInfo = {
  name: string
  display_name?: string
  description?: string
  category: string
  input?: {
    required?: Record<string, ComfyObjectInfoConfig>
    optional?: Record<string, ComfyObjectInfoConfig>
  }
  output?: string[]
  output_name: string[]
}

export type ComfyObjectInfoConfig = [string | any[]] | [string | any[], any]
