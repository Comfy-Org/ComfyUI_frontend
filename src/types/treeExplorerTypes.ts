export interface TreeExplorerNode<T = any> {
  key: string
  label: string
  data: T
  leaf: boolean
  children?: TreeExplorerNode<T>[]
  icon?: string
  getIcon?: (node: TreeExplorerNode<T>) => string
  // Function to handle renaming the node
  handleRename?: (node: TreeExplorerNode<T>, newName: string) => void
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
