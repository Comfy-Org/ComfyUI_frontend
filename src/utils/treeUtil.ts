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
