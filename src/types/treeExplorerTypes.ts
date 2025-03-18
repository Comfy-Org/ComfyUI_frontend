import type { MenuItem } from 'primevue/menuitem'
import type { InjectionKey, ModelRef } from 'vue'

export interface TreeExplorerNode<T = any> {
  key: string
  label: string
  leaf: boolean
  data?: T
  children?: TreeExplorerNode<T>[]
  icon?: string
  /** Function to override what icon to use for the node */
  getIcon?: (this: TreeExplorerNode<T>) => string
  /** Function to override what text to use for the leaf-count badge on a folder node */
  getBadgeText?: (this: TreeExplorerNode<T>) => string
  /** Function to handle renaming the node */
  handleRename?: (
    this: TreeExplorerNode<T>,
    newName: string
  ) => void | Promise<void>
  /** Function to handle deleting the node */
  handleDelete?: (this: TreeExplorerNode<T>) => void | Promise<void>
  /** Function to handle adding a folder */
  handleAddFolder?: (
    this: TreeExplorerNode<T>,
    folderName: string
  ) => void | Promise<void>
  /** Whether the node is draggable */
  draggable?: boolean
  /** Function to render a drag preview */
  renderDragPreview?: (
    this: TreeExplorerNode<T>,
    container: HTMLElement
  ) => void | (() => void)
  /** Whether the node is droppable */
  droppable?: boolean
  /** Function to handle dropping a node */
  handleDrop?: (
    this: TreeExplorerNode<T>,
    data: TreeExplorerDragAndDropData
  ) => void | Promise<void>
  /** Function to handle clicking a node */
  handleClick?: (
    this: TreeExplorerNode<T>,
    event: MouseEvent
  ) => void | Promise<void>
  /** Function to handle errors */
  handleError?: (this: TreeExplorerNode<T>, error: Error) => void
  /** Extra context menu items */
  contextMenuItems?:
    | MenuItem[]
    | ((targetNode: RenderedTreeExplorerNode) => MenuItem[])
}

export interface RenderedTreeExplorerNode<T = any> extends TreeExplorerNode<T> {
  children?: RenderedTreeExplorerNode<T>[]
  icon: string
  type: 'folder' | 'node'
  /** Total number of leaves in the subtree */
  totalLeaves: number
  /** Text to display on the leaf-count badge. Empty string means no badge. */
  badgeText?: string
  /** Whether the node label is currently being edited */
  isEditingLabel?: boolean
}

export type TreeExplorerDragAndDropData<T = any> = {
  type: 'tree-explorer-node'
  data: RenderedTreeExplorerNode<T>
}

export const InjectKeyHandleEditLabelFunction: InjectionKey<
  (node: RenderedTreeExplorerNode, newName: string) => void
> = Symbol()

export const InjectKeyExpandedKeys: InjectionKey<
  ModelRef<Record<string, boolean>>
> = Symbol()
