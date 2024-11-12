import type { MenuItem } from 'primevue/menuitem'

export interface TreeExplorerNode<T = any> {
  key: string
  label: string
  leaf: boolean
  data?: T
  children?: TreeExplorerNode<T>[]
  icon?: string
  /** Function to override what icon to use for the node */
  getIcon?: (node: TreeExplorerNode<T>) => string
  /** Function to override what text to use for the leaf-count badge on a folder node */
  getBadgeText?: (node: TreeExplorerNode<T>) => string
  /** Function to handle renaming the node */
  handleRename?: (
    node: TreeExplorerNode<T>,
    newName: string
  ) => void | Promise<void>
  /** Function to handle deleting the node */
  handleDelete?: (node: TreeExplorerNode<T>) => void | Promise<void>
  /** Function to handle adding a child node */
  handleAddChild?: (
    node: TreeExplorerNode<T>,
    child: TreeExplorerNode<T>
  ) => void | Promise<void>
  /** Whether the node is draggable */
  draggable?: boolean
  /** Whether the node is droppable */
  droppable?: boolean
  /** Function to handle dropping a node */
  handleDrop?: (
    node: TreeExplorerNode<T>,
    data: TreeExplorerDragAndDropData
  ) => void | Promise<void>
  /** Function to handle clicking a node */
  handleClick?: (
    node: TreeExplorerNode<T>,
    event: MouseEvent
  ) => void | Promise<void>
  /** Function to handle errors */
  handleError?: (error: Error) => void
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
}

export type TreeExplorerDragAndDropData<T = any> = {
  type: 'tree-explorer-node'
  data: RenderedTreeExplorerNode<T>
}
