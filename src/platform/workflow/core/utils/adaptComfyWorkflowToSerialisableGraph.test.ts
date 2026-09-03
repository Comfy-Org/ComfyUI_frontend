import { describe, expect, it } from 'vitest'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import { adaptComfyWorkflowToSerialisableGraph } from './adaptComfyWorkflowToSerialisableGraph'
import { workflowToClipboardItems } from './workflowToClipboardItems'

type WorkflowJSON1 = Extract<ComfyWorkflowJSON, { version: 1 }>
type WorkflowSubgraph = NonNullable<
  NonNullable<WorkflowJSON1['definitions']>['subgraphs']
>[number] &
  WorkflowJSON1

function graphState() {
  return {
    lastGroupId: 0,
    lastNodeId: 1,
    lastLinkId: 0,
    lastRerouteId: 0
  }
}

function workflowSubgraph(
  id: string,
  name: string,
  definitions?: WorkflowSubgraph['definitions']
): WorkflowSubgraph {
  return {
    id,
    revision: 1,
    name,
    version: 1,
    state: graphState(),
    inputNode: { id: -10, bounding: [0, 0, 20, 20] },
    outputNode: { id: -20, bounding: [100, 0, 20, 20] },
    nodes: [
      {
        id: 1,
        type: 'TestNode',
        pos: [0, 0],
        size: [100, 100],
        flags: {},
        order: 0,
        mode: 0,
        properties: { nested: { values: [name] } },
        widgets_values: [{ label: name }]
      }
    ],
    groups: [
      {
        id: 1,
        title: `${name} group`,
        bounding: [0, 0, 100, 100],
        metadata: { label: name }
      }
    ],
    extra: {
      metadata: { label: name },
      reroutes: [{ id: 1, pos: [20, 30], linkIds: null }]
    },
    definitions
  }
}

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
    const original = structuredClone(workflow)

    const graph = adaptComfyWorkflowToSerialisableGraph(workflow)

    expect(graph).toMatchObject({
      version: 0.4,
      last_node_id: 42,
      last_link_id: 1,
      links: [[1, 1, 0, 2, 0, 'MODEL,LATENT']]
    })
    expect(workflow).toEqual(original)
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
          properties: {},
          widgets_values: {
            ckpt_name: 'model.safetensors',
            strength: 0.5
          }
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
      nodes: [
        {
          inputs: [{ type: 'MODEL,LATENT' }],
          widgets_values: ['model.safetensors', 0.5]
        }
      ],
      links: [{ id: 4, type: 'MODEL,LATENT', parentId: 5 }],
      reroutes: [{ id: 5, pos: [60, 70], linkIds: [] }]
    })

    const workflowWithNamedLength = structuredClone(workflow)
    workflowWithNamedLength.nodes[0].widgets_values = {
      length: 1,
      ckpt_name: 'model.safetensors'
    }
    expect(
      adaptComfyWorkflowToSerialisableGraph(workflowWithNamedLength).nodes?.[0]
        ?.widgets_values
    ).toEqual(['model.safetensors'])
    expect(workflow.nodes[0].inputs?.[0].type).toEqual(['MODEL', 'LATENT'])
  })

  it('recursively adapts nested workflow data without mutating the input', () => {
    const childId = '22222222-2222-4222-8222-222222222222'
    const parentId = '11111111-1111-4111-8111-111111111111'
    const child = workflowSubgraph(childId, 'Child')
    const parent = workflowSubgraph(parentId, 'Parent', {
      subgraphs: [child]
    })
    const workflow: WorkflowJSON1 = {
      version: 1,
      state: graphState(),
      nodes: [
        {
          id: 1,
          type: parentId,
          pos: [0, 0],
          size: [100, 100],
          flags: {},
          order: 0,
          mode: 0,
          properties: { nested: { values: ['Root'] } },
          widgets_values: [{ label: 'Root' }]
        }
      ],
      groups: [
        {
          id: 1,
          title: 'Root group',
          bounding: [0, 0, 100, 100],
          metadata: { label: 'Root' }
        }
      ],
      subgraphs: [
        {
          id: 2,
          type: parentId,
          pos: [100, 100],
          size: [100, 100],
          flags: {},
          order: 1,
          mode: 0,
          widgets_values: { 0: { label: 'Instance' }, length: 1 }
        }
      ],
      extra: {
        metadata: { label: 'Root' },
        reroutes: [{ id: 1, pos: [10, 20], linkIds: null }]
      },
      definitions: { subgraphs: [parent] }
    }
    const original = structuredClone(workflow)

    const graph = adaptComfyWorkflowToSerialisableGraph(workflow)

    expect(graph).toMatchObject({
      nodes: [
        {
          properties: { nested: { values: ['Root'] } },
          widgets_values: [{ label: 'Root' }]
        }
      ],
      groups: [{ metadata: { label: 'Root' } }],
      subgraphs: [{ widgets_values: [{ label: 'Instance' }] }],
      extra: {
        metadata: { label: 'Root' },
        reroutes: [{ linkIds: [] }]
      },
      definitions: {
        subgraphs: [
          {
            nodes: [
              {
                properties: { nested: { values: ['Parent'] } },
                widgets_values: [{ label: 'Parent' }]
              }
            ],
            groups: [{ metadata: { label: 'Parent' } }],
            extra: {
              metadata: { label: 'Parent' },
              reroutes: [{ linkIds: [] }]
            },
            definitions: {
              subgraphs: [
                {
                  nodes: [
                    {
                      properties: { nested: { values: ['Child'] } },
                      widgets_values: [{ label: 'Child' }]
                    }
                  ],
                  groups: [{ metadata: { label: 'Child' } }],
                  extra: {
                    metadata: { label: 'Child' },
                    reroutes: [{ linkIds: [] }]
                  }
                }
              ]
            }
          }
        ]
      }
    })
    expect(workflow).toEqual(original)
  })

  it('rejects malformed version 1 subgraph definitions', () => {
    const invalidSubgraph = workflowSubgraph(
      '11111111-1111-4111-8111-111111111111',
      'Invalid'
    )
    Reflect.deleteProperty(invalidSubgraph, 'inputNode')
    const workflow: WorkflowJSON1 = {
      version: 1,
      state: graphState(),
      nodes: [],
      definitions: { subgraphs: [invalidSubgraph] }
    }

    expect(() => adaptComfyWorkflowToSerialisableGraph(workflow)).toThrow(
      new TypeError('Invalid version 1 workflow subgraph')
    )
  })
})
