import type { TreeNode } from 'primevue/treenode'

export function buildTree<T>(items: T[], key: (item: T) => string[]): TreeNode {
  const root: TreeNode = {
    key: 'root',
    label: 'root',
    children: []
  }

  const map: Record<string, TreeNode> = {
    root: root
  }

  for (const item of items) {
    const keys = key(item)
    let parent = root
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i]
      // 'a/b/c/' represents an empty folder 'c' in folder 'b' in folder 'a'
      // 'a/b/c/' is split into ['a', 'b', 'c', '']
      if (k === '' && i === keys.length - 1) break

      const id = parent.key + '/' + k
      if (!map[id]) {
        const node: TreeNode = {
          key: id,
          label: k,
          leaf: false,
          children: []
        }
        map[id] = node
        parent.children?.push(node)
      }
      parent = map[id]
    }
    parent.leaf = keys[keys.length - 1] !== ''
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
      (a.label ?? '').localeCompare(b.label ?? '')
    )
    // Recursively sort the children and add them to the new node
    newNode.children = []
    for (const child of sortedChildren) {
      newNode.children.push(sortedTree(child))
    }
  }

  return newNode
}

export const findNodeByKey = (root: TreeNode, key: string): TreeNode | null => {
  if (root.key === key) {
    return root
  }
  if (!root.children) {
    return null
  }
  for (const child of root.children) {
    const result = findNodeByKey(child, key)
    if (result) {
      return result
    }
  }
  return null
}
