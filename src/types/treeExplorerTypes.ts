import { Ref } from 'vue'

export interface TreeExplorerNode<T = any> {
  key: string
  label: string
  data: T
  leaf: boolean
  children?: TreeExplorerNode<T>[]
  icon?: string | ((node: TreeExplorerNode<T>) => string)
}

export interface RenderedTreeExplorerNode<T = any> extends TreeExplorerNode<T> {
  children?: RenderedTreeExplorerNode<T>[]
  icon: string
  type: 'folder' | 'node'
  // Total number of leaves in the subtree
  totalLeaves: number
}

export type TreeExplorerDragAndDropData<T = any> = {
  type: 'tree-explorer-node'
  data: RenderedTreeExplorerNode<T>
}

export interface TreeExplorerNodeSlotProps {
  node: RenderedTreeExplorerNode
  handleItemDropped: (node: RenderedTreeExplorerNode) => void
  renameEditingNode: Ref<RenderedTreeExplorerNode | null>
  handleRename: (node: RenderedTreeExplorerNode, newName: string) => void
}
