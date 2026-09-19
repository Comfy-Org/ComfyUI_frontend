import { describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { toRootGraphId } from '@/types/graphScopeId'

import { useNodeTitleCustomizationStore } from './nodeTitleCustomizationStore'

describe('clearNodeOwnedStoreState', () => {
  it('clears a node id customized-title flag when the node is genuinely removed', () => {
    const graph = new LGraph()
    const node = new LGraphNode('renamed node')
    graph.add(node)
    const rootGraphId = toRootGraphId(graph.id)
    const customizationStore = useNodeTitleCustomizationStore()
    customizationStore.markCustomized(rootGraphId, node.id)
    expect(customizationStore.isCustomized(rootGraphId, node.id)).toBe(true)

    graph.remove(node)

    expect(customizationStore.isCustomized(rootGraphId, node.id)).toBe(false)
  })

  it('does not flag an unrelated later node that reuses a deleted node id as customized', () => {
    const graph = new LGraph()
    const first = new LGraphNode('renamed node')
    graph.add(first)
    const rootGraphId = toRootGraphId(graph.id)
    const reusedId = first.id
    useNodeTitleCustomizationStore().markCustomized(rootGraphId, reusedId)
    graph.remove(first)

    const second = new LGraphNode('later node')
    second.id = reusedId
    graph.add(second)

    expect(
      useNodeTitleCustomizationStore().isCustomized(rootGraphId, second.id)
    ).toBe(false)
  })
})
