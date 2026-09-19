import { describe, expect, it } from 'vitest'

import { LGraph } from '@/lib/litegraph/src/litegraph'
import { toRootGraphId } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'

import { useNodeTitleCustomizationStore } from './nodeTitleCustomizationStore'

describe('useNodeTitleCustomizationStore', () => {
  const rootA = toRootGraphId('root-a')
  const rootB = toRootGraphId('root-b')
  const node1 = toNodeId(1)
  const node2 = toNodeId(2)

  it('is not customized for a node that was never marked', () => {
    const store = useNodeTitleCustomizationStore()
    expect(store.isCustomized(rootA, node1)).toBe(false)
  })

  it('reports a marked node id as customized', () => {
    const store = useNodeTitleCustomizationStore()
    store.markCustomized(rootA, node1)
    expect(store.isCustomized(rootA, node1)).toBe(true)
    expect(store.isCustomized(rootA, node2)).toBe(false)
  })

  it('marking twice is idempotent', () => {
    const store = useNodeTitleCustomizationStore()
    store.markCustomized(rootA, node1)
    store.markCustomized(rootA, node1)
    expect(store.isCustomized(rootA, node1)).toBe(true)
  })

  it('scopes customization by root graph id: the same node id under two roots is independent', () => {
    const store = useNodeTitleCustomizationStore()
    store.markCustomized(rootA, node1)

    expect(store.isCustomized(rootA, node1)).toBe(true)
    expect(store.isCustomized(rootB, node1)).toBe(false)

    store.markCustomized(rootB, node1)
    store.clearNode(rootA, node1)

    expect(store.isCustomized(rootA, node1)).toBe(false)
    expect(store.isCustomized(rootB, node1)).toBe(true)
  })

  it('clearNode on an unmarked node id is a no-op', () => {
    const store = useNodeTitleCustomizationStore()
    expect(() => store.clearNode(rootA, node1)).not.toThrow()
    expect(store.isCustomized(rootA, node1)).toBe(false)
  })

  it('clearGraph removes every customized node id under that root', () => {
    const store = useNodeTitleCustomizationStore()
    store.markCustomized(rootA, node1)
    store.markCustomized(rootA, node2)
    store.markCustomized(rootB, node1)

    store.clearGraph(rootA)

    expect(store.isCustomized(rootA, node1)).toBe(false)
    expect(store.isCustomized(rootA, node2)).toBe(false)
    expect(store.isCustomized(rootB, node1)).toBe(true)
  })

  it(
    'documented limitation: a root graph id regeneration (e.g. undo/redo, ' +
      'via LGraph.clear()) orphans previously customized flags for that root',
    () => {
      const store = useNodeTitleCustomizationStore()
      const graph = new LGraph()
      const rootGraphId = toRootGraphId(graph.id)
      store.markCustomized(rootGraphId, node1)
      expect(store.isCustomized(rootGraphId, node1)).toBe(true)

      graph.clear()
      const regeneratedRootGraphId = toRootGraphId(graph.id)

      expect(regeneratedRootGraphId).not.toBe(rootGraphId)
      expect(store.isCustomized(regeneratedRootGraphId, node1)).toBe(false)
    }
  )
})
