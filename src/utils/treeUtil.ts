import { TreeNode } from 'primevue/treenode'

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
