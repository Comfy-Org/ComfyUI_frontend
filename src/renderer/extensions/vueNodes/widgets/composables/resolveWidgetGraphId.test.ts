import { describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { resolveWidgetGraphId } from '@/renderer/extensions/vueNodes/widgets/composables/resolveWidgetGraphId'

const rootGraphState = vi.hoisted(() => ({ id: 'root-graph-id' }))

vi.mock('@/scripts/app', () => ({
  app: {
    rootGraph: rootGraphState
  }
}))

type GraphIdNode = Pick<LGraphNode, 'graph'>

describe('resolveWidgetGraphId', () => {
  it('returns node rootGraph id when node belongs to a graph', () => {
    const node = {
      graph: {
        rootGraph: {
          id: 'subgraph-root-id'
        }
      }
    } as GraphIdNode

    expect(resolveWidgetGraphId(node as LGraphNode)).toBe('subgraph-root-id')
  })

  it('falls back to app rootGraph id when node graph is missing', () => {
    const node = {
      graph: null
    } as GraphIdNode

    rootGraphState.id = 'app-root-id'

    expect(resolveWidgetGraphId(node as LGraphNode)).toBe('app-root-id')
  })
})
