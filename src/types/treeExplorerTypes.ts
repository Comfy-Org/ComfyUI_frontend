import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type { NodeCategoryId } from '@/types/nodeOrganizationTypes'
import type { InjectionKey, ModelRef, Ref } from 'vue'

import type { MenuItem } from '@/components/ui/menu/types'

export interface TreeNode<T = unknown> {
  key: string
  label: string
  children?: this[]
  data?: T
  icon?: string
  leaf?: boolean
}

export interface NodeLibrarySection<T = unknown> {
  category?: NodeCategoryId
  title?: string
  root: RenderedTreeExplorerNode<T>
}

export interface TreeExplorerNode<T = unknown> extends TreeNode<T> {
  /** Extra context menu items */
  contextMenuItems?:
    | MenuItem[]
    | ((targetNode: RenderedTreeExplorerNode<T>) => MenuItem[])
  /** Whether the node is draggable */
  draggable?: boolean
  /** Whether the node is droppable */
  droppable?: boolean
  /**
   * Function to override what text to use for the leaf-count badge on a folder node.
   * Return undefined to fallback to default badge text, which is the subtree's leaf count.
   * Return empty string to hide the badge.
   */
  getBadgeText?: (this: TreeExplorerNode<T>) => string | undefined
  /**
   * Function to override what icon to use for the node.
   * Return undefined to fallback to {@link icon} property.
   */
  getIcon?: (this: TreeExplorerNode<T>) => string | undefined
  getIconColor?: (this: TreeExplorerNode<T>) => string | undefined
  /** Function to handle adding a folder */
  handleAddFolder?: (
    this: TreeExplorerNode<T>,
    folderName: string
  ) => void | Promise<void>
  /** Function to handle clicking a node */
  handleClick?: (
    this: TreeExplorerNode<T>,
    event: MouseEvent
  ) => void | Promise<void>
  /** Function to handle deleting the node */
  handleDelete?: (this: TreeExplorerNode<T>) => void | Promise<void>
  /** Function to handle dropping a node */
  handleDrop?: (
    this: TreeExplorerNode<T>,
    data: TreeExplorerDragAndDropData<T>
  ) => void | Promise<void>
  /** Function to handle errors */
  handleError?: (this: TreeExplorerNode<T>, error: unknown) => void
  /** Function to handle renaming the node */
  handleRename?: (
    this: TreeExplorerNode<T>,
    newName: string
  ) => void | Promise<void>
  /** Function to render a drag preview */
  renderDragPreview?: (
    this: TreeExplorerNode<T>,
    container: HTMLElement
  ) => void | (() => void)
}

export interface RenderedTreeExplorerNode<
  T = unknown
> extends TreeExplorerNode<T> {
  icon: string
  /** Total number of leaves in the subtree */
  totalLeaves: number
  type: 'folder' | 'node'
  /** Text to display on the leaf-count badge. Empty string means no badge. */
  badgeText?: string
  children?: this[]
  iconColor?: string
  /** Whether the node label is currently being edited */
  isEditingLabel?: boolean
}

export type TreeExplorerDragAndDropData<T = unknown> = {
  type: 'tree-explorer-node'
  data: RenderedTreeExplorerNode<T>
}

export const InjectKeyHandleEditLabelFunction: InjectionKey<
  (node: RenderedTreeExplorerNode, newName: string) => void
> = Symbol()

export const InjectKeyExpandedKeys: InjectionKey<
  ModelRef<Record<string, boolean>>
> = Symbol()

export const InjectKeyContextMenuNode: InjectionKey<
  Ref<RenderedTreeExplorerNode<ComfyNodeDefImpl> | null>
> = Symbol()
