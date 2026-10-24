import { describe, expect, it, vi } from 'vitest'

import { LGraph } from '@/lib/litegraph/src/litegraph'
import {
  createTestRootGraph,
  createTestSubgraphData,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
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
