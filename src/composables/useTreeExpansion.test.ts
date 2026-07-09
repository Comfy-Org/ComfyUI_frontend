import { ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { useTreeExpansion } from '@/composables/useTreeExpansion'
import type { TreeNode } from '@/types/treeExplorerTypes'

function node(over: Partial<TreeNode>): TreeNode {
  return over as TreeNode
}

// root ─┬─ a ── a1 (leaf)
//       └─ b (leaf)
function sampleTree() {
  const a1 = node({ key: 'a1', leaf: true })
  const a = node({ key: 'a', leaf: false, children: [a1] })
  const b = node({ key: 'b', leaf: true })
  const root = node({ key: 'root', leaf: false, children: [a, b] })
  return { root, a, a1, b }
}

describe('useTreeExpansion', () => {
  it('toggleNode adds then removes a node key', () => {
    const expandedKeys = ref<Record<string, boolean>>({})
    const { toggleNode } = useTreeExpansion(expandedKeys)
    const n = node({ key: 'x' })

    toggleNode(n)
    expect(expandedKeys.value).toEqual({ x: true })

    toggleNode(n)
    expect(expandedKeys.value).toEqual({})
  })

  it('toggleNode ignores nodes without a string key', () => {
    const expandedKeys = ref<Record<string, boolean>>({})
    const { toggleNode } = useTreeExpansion(expandedKeys)

    toggleNode(node({ key: undefined }))

    expect(expandedKeys.value).toEqual({})
  })

  it('expandNode expands the node and all non-leaf descendants only', () => {
    const expandedKeys = ref<Record<string, boolean>>({})
    const { expandNode } = useTreeExpansion(expandedKeys)
    const { root } = sampleTree()

    expandNode(root)

    // root and a are folders; a1 and b are leaves and must be skipped
    expect(expandedKeys.value).toEqual({ root: true, a: true })
  })

  it('expandNode does nothing for a leaf node', () => {
    const expandedKeys = ref<Record<string, boolean>>({})
    const { expandNode } = useTreeExpansion(expandedKeys)

    expandNode(node({ key: 'leaf', leaf: true }))

    expect(expandedKeys.value).toEqual({})
  })

  it('collapseNode removes the node and its non-leaf descendants', () => {
    const expandedKeys = ref<Record<string, boolean>>({
      root: true,
      a: true,
      stray: true
    })
    const { collapseNode } = useTreeExpansion(expandedKeys)
    const { root } = sampleTree()

    collapseNode(root)

    expect(expandedKeys.value).toEqual({ stray: true })
  })

  it('toggleNodeRecursive expands when collapsed and collapses when expanded', () => {
    const expandedKeys = ref<Record<string, boolean>>({})
    const { toggleNodeRecursive } = useTreeExpansion(expandedKeys)
    const { root } = sampleTree()

    toggleNodeRecursive(root)
    expect(expandedKeys.value).toEqual({ root: true, a: true })

    toggleNodeRecursive(root)
    expect(expandedKeys.value).toEqual({})
  })

  it('toggleNodeOnEvent toggles recursively with ctrl and singly without', () => {
    const expandedKeys = ref<Record<string, boolean>>({})
    const { toggleNodeOnEvent } = useTreeExpansion(expandedKeys)
    const { root } = sampleTree()

    toggleNodeOnEvent(new KeyboardEvent('keydown', { ctrlKey: true }), root)
    expect(expandedKeys.value).toEqual({ root: true, a: true })

    // Plain toggle removes only the node's own key, leaving descendants
    toggleNodeOnEvent(new MouseEvent('click'), root)
    expect(expandedKeys.value).toEqual({ a: true })
  })
})
