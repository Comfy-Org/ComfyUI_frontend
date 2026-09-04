import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/scripts/app', () => ({
  app: { rootGraph: undefined }
}))

import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useSubgraphService } from '@/services/subgraphService'
import { useNodeDefStore } from '@/stores/nodeDefStore'

describe('useSubgraphService', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('unregisters a released definition from node creation and search', () => {
    const id = '11111111-1111-4111-8111-111111111111'
    class TestSubgraphNode extends LGraphNode {}
    LiteGraph.registerNodeType(id, TestSubgraphNode)
    useNodeDefStore().nodeDefsByName[id] = {} as never

    useSubgraphService().unregisterSubgraph(id)

    expect(LiteGraph.registered_node_types[id]).toBeUndefined()
    expect(useNodeDefStore().nodeDefsByName[id]).toBeUndefined()
  })
})
