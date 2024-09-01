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
  // Function to handle deleting the node
  handleDelete?: (node: TreeExplorerNode<T>) => void
  // Function to handle adding a child node
  handleAddChild?: (
    node: TreeExplorerNode<T>,
    child: TreeExplorerNode<T>
  ) => void
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
