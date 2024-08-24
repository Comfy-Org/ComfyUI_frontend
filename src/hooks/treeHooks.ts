import { ref } from 'vue'
import type { TreeNode } from 'primevue/treenode'

export function useTreeExpansion() {
  const expandedKeys = ref<Record<string, boolean>>({})

  const toggleNode = (node: TreeNode) => {
    if (node.key && typeof node.key === 'string') {
      if (node.key in expandedKeys.value) {
        delete expandedKeys.value[node.key]
      } else {
        expandedKeys.value[node.key] = true
      }
    }
  }

  const toggleNodeRecursive = (node: TreeNode) => {
    if (node.key && typeof node.key === 'string') {
      if (node.key in expandedKeys.value) {
        collapseNode(node)
      } else {
        expandNode(node)
      }
    }
  }

  const expandNode = (node: TreeNode) => {
    if (
      node.key &&
      typeof node.key === 'string' &&
      node.children &&
      node.children.length
    ) {
      expandedKeys.value[node.key] = true

      for (const child of node.children) {
        expandNode(child)
      }
    }
  }

  const collapseNode = (node: TreeNode) => {
    if (
      node.key &&
      typeof node.key === 'string' &&
      node.children &&
      node.children.length
    ) {
      delete expandedKeys.value[node.key]

      for (const child of node.children) {
        collapseNode(child)
      }
    }
  }

  const onNonLeafClick = (e: MouseEvent, node: TreeNode) => {
    if (e.ctrlKey) {
      toggleNodeRecursive(node)
    } else {
      toggleNode(node)
    }
  }

  return {
    expandedKeys,
    toggleNode,
    toggleNodeRecursive,
    expandNode,
    collapseNode,
    onNonLeafClick
  }
}
