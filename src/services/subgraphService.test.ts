import { describe, expect, it, vi } from 'vitest'

import { LGraph } from '@comfyorg/litegraph/litegraph'
import {
  createTestRootGraph,
  createTestSubgraphData,
  createTestSubgraphNode
} from '@comfyorg/litegraph/subgraph/__fixtures__/subgraphHelpers'
import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import { validateComfyWorkflow } from '@comfyorg/graph-model/workflowSchema'
import { useSubgraphService } from '@/services/subgraphService'

vi.mock(import('@/services/litegraphService'))

async function workflowWithSubgraph(): Promise<{
  graphData: ComfyWorkflowJSON
  subgraphId: string
}> {
  const source = createTestRootGraph()
  const subgraph = source.createSubgraph(createTestSubgraphData())
  source.add(createTestSubgraphNode(subgraph))
  const graphData = await validateComfyWorkflow(source.serialize(), (error) => {
    throw new Error(error)
  })
  if (!graphData) throw new Error('invalid workflow fixture')
  return { graphData, subgraphId: subgraph.id }
}

describe('useSubgraphService', () => {
  it('creates the workflow subgraph definitions on the graph being loaded', async () => {
    const { graphData, subgraphId } = await workflowWithSubgraph()
    const loading = new LGraph()

    useSubgraphService().loadSubgraphs(graphData, loading)

    expect(loading.subgraphs.has(subgraphId)).toBe(true)
  })
})
