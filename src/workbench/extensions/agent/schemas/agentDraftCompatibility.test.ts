import { normalizeLegacyWorkflowGroupIds } from '@comfyorg/comfy-multi-player'
import { describe, expect, it } from 'vitest'

import { createTestSubgraphData } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'

describe('Agent draft compatibility with workflow validation', () => {
  it('accepts normalized groups throughout nested definitions', async () => {
    const group = { title: 'Recovered group', bounding: [0, 0, 300, 200] }
    const nested = {
      ...createTestSubgraphData(),
      groups: [
        {
          ...group,
          id: 'insert:op:root/definition:outer/definition:inner:group:7'
        }
      ]
    }
    const subgraph = {
      ...createTestSubgraphData(),
      groups: [{ ...group, id: 'insert:op:root/definition:outer:group:7' }],
      definitions: { subgraphs: [nested] }
    }
    const content = {
      version: 0.4,
      last_node_id: 0,
      last_link_id: 0,
      nodes: [],
      links: [],
      groups: [{ ...group, id: 'insert:op:root:group:7' }],
      definitions: { subgraphs: [subgraph] }
    }

    await expect(
      validateComfyWorkflow(normalizeLegacyWorkflowGroupIds(content))
    ).resolves.not.toBeNull()
  })

  it.for(['', null, true])(
    'still rejects malformed group ID %s',
    async (id) => {
      const content = {
        version: 0.4,
        last_node_id: 0,
        last_link_id: 0,
        nodes: [],
        links: [],
        groups: [{ id, title: 'Invalid group', bounding: [0, 0, 300, 200] }]
      }

      await expect(
        validateComfyWorkflow(
          normalizeLegacyWorkflowGroupIds(content),
          () => {}
        )
      ).resolves.toBeNull()
    }
  )

  it('still rejects malformed geometry after converting a legacy ID', async () => {
    const content = {
      version: 0.4,
      last_node_id: 0,
      last_link_id: 0,
      nodes: [],
      links: [],
      groups: [
        { id: 'insert:op:root:group:7', title: 'Invalid group', bounding: [] }
      ]
    }

    await expect(
      validateComfyWorkflow(normalizeLegacyWorkflowGroupIds(content), () => {})
    ).resolves.toBeNull()
  })
})
