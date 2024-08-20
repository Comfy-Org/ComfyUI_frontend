import type { TreeNode } from 'primevue/treenode'

export function buildTree<T>(
  items: T[],
  key: string | ((item: T) => string[])
): TreeNode {
  const root: TreeNode = {
    key: 'root',
    label: 'root',
    children: []
  }

  const map: Record<string, TreeNode> = {
    root: root
  }

  for (const item of items) {
    const keys = typeof key === 'string' ? item[key] : key(item)
    let parent = root
    for (const k of keys) {
      const id = parent.key + '/' + k
      if (!map[id]) {
        const node: TreeNode = {
          key: id,
          label: k,
          leaf: false,
          children: []
        }
        map[id] = node
        parent.children.push(node)
      }
      parent = map[id]
    }
    parent.leaf = true
    parent.data = item
  }
  return root
}

export function flattenTree<T>(tree: TreeNode): T[] {
  const result: T[] = []
  const stack: TreeNode[] = [tree]
  while (stack.length) {
    const node = stack.pop()!
    if (node.leaf && node.data) result.push(node.data)
    stack.push(...(node.children || []))
  }
  return result
}

export function sortedTree(node: TreeNode): TreeNode {
  // Create a new node with the same label and data
  const newNode: TreeNode = {
    ...node
  }

  if (node.children) {
    // Sort the children of the current node
    const sortedChildren = [...node.children].sort((a, b) =>
      a.label.localeCompare(b.label)
    )
    // Recursively sort the children and add them to the new node
    newNode.children = []
    for (const child of sortedChildren) {
      newNode.children.push(sortedTree(child))
    }
  }

  return newNode
}
