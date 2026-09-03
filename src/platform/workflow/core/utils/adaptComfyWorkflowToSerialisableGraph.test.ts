import { describe, expect, it } from 'vitest'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import { adaptComfyWorkflowToSerialisableGraph } from './adaptComfyWorkflowToSerialisableGraph'
import { workflowToClipboardItems } from './workflowToClipboardItems'

describe('adaptComfyWorkflowToSerialisableGraph', () => {
  it('adapts legacy tuple links and preserves legacy state', () => {
    const workflow: ComfyWorkflowJSON = {
      version: 0.3,
      last_node_id: 42,
      last_link_id: 1,
      nodes: [],
      groups: [],
      links: [[1, 1, 0, 2, 0, ['MODEL', 'LATENT']]],
      extra: {
        linkExtensions: [{ id: 1, parentId: 7 }],
        reroutes: [{ id: 7, pos: [40, 50], linkIds: null }]
      }
    }

    const graph = adaptComfyWorkflowToSerialisableGraph(workflow)

    expect(graph).toMatchObject({
      version: 0.4,
      last_node_id: 42,
      last_link_id: 1,
      links: [[1, 1, 0, 2, 0, 'MODEL,LATENT']]
    })
    expect(workflow.version).toBe(0.3)
    expect(workflowToClipboardItems(graph)).toMatchObject({
      links: [{ id: 1, type: 'MODEL,LATENT', parentId: 7 }],
      reroutes: [{ id: 7, pos: [40, 50], linkIds: [] }]
    })
  })

  it('adapts current object links, state, reroutes, and slot types', () => {
    const workflow: ComfyWorkflowJSON = {
      version: 1,
      state: {
        lastGroupId: 2,
        lastNodeId: 3,
        lastLinkId: 4,
        lastRerouteId: 5
      },
      nodes: [
        {
          id: 1,
          type: 'TestNode',
          pos: [0, 0],
          size: [100, 100],
          flags: {},
          order: 0,
          mode: 0,
          inputs: [{ name: 'input', type: ['MODEL', 'LATENT'] }],
          properties: {}
        }
      ],
      links: [
        {
          id: 4,
          origin_id: 1,
          origin_slot: 0,
          target_id: 2,
          target_slot: 0,
          type: ['MODEL', 'LATENT'],
          parentId: 5
        }
      ],
      reroutes: [{ id: 5, pos: [60, 70], linkIds: null }]
    }

    const graph = adaptComfyWorkflowToSerialisableGraph(workflow)

    expect(graph).toMatchObject({
      version: 1,
      state: workflow.state,
      nodes: [{ inputs: [{ type: 'MODEL,LATENT' }] }],
      links: [{ id: 4, type: 'MODEL,LATENT', parentId: 5 }],
      reroutes: [{ id: 5, pos: [60, 70], linkIds: [] }]
    })
    expect(workflow.nodes[0].inputs?.[0].type).toEqual(['MODEL', 'LATENT'])
  })
})
