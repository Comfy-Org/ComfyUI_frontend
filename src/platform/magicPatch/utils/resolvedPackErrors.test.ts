import { describe, expect, it } from 'vitest'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { InstalledPublication } from './selectedPublisherRevision'
import { remainingPackErrors } from './resolvedPackErrors'

const publication: InstalledPublication = {
  sourcePackId: 'randomnumbers',
  sourceRevisionId: 'a'.repeat(64),
  installedPackId: 'user-owner/randomnumbers',
  installedRevisionId: 'b'.repeat(64),
  nodeTypes: { RandomNumber: 'User_owner_RandomNumber' }
}
const node = (id: number, pack = 'randomnumbers') => ({
  id,
  type: 'RandomNumber',
  properties: { cnr_id: pack }
})
const workflow = (nodes: ReturnType<typeof node>[]) =>
  ({ nodes }) as ComfyWorkflowJSON

describe('errors resolved by verified pack publications', () => {
  it('clears the matching node without clearing another pack with the same node type', () => {
    const graph = workflow([node(7), node(8, 'other-pack')])
    const errors = [
      { type: 'RandomNumber', nodeId: 7 },
      { type: 'RandomNumber', nodeId: 8 }
    ]
    expect(
      remainingPackErrors(errors, graph, [publication], graph, [])
    ).toEqual([errors[1]])
    expect(graph.nodes[0]!.type).toBe('RandomNumber')
  })

  it('keeps ambiguous legacy errors when any same-type node is unresolved', () => {
    const graph = workflow([node(7), node(8, 'other-pack')])
    expect(
      remainingPackErrors(['RandomNumber'], graph, [publication], graph, [])
    ).toEqual(['RandomNumber'])
  })

  it('preserves errors without execution IDs until the workflow reload resolves them', () => {
    const graph = workflow([node(7), node(8)])
    expect(
      remainingPackErrors(
        ['RandomNumber', 'Unknown'],
        graph,
        [publication],
        graph,
        []
      )
    ).toEqual(['RandomNumber', 'Unknown'])
  })

  it('clears nested execution IDs while preserving a root node with the same local ID', () => {
    const graph = {
      nodes: [node(7, 'other-pack'), { id: 5, type: 'subgraph-a' }],
      definitions: {
        subgraphs: [
          {
            id: 'subgraph-a',
            name: 'Nested',
            nodes: [node(7)],
            inputNode: {},
            outputNode: {}
          }
        ]
      }
    } as ComfyWorkflowJSON
    const errors = [
      { type: 'RandomNumber', nodeId: 7 },
      { type: 'RandomNumber', nodeId: '5:7' }
    ]
    expect(
      remainingPackErrors(errors, graph, [publication], graph, [])
    ).toEqual([errors[0]])
  })

  it('keeps errors for nodes added after conversion started', () => {
    const original = workflow([node(7)])
    const graph = workflow([node(7), node(8)])
    const errors = [
      { type: 'RandomNumber', nodeId: 7 },
      { type: 'RandomNumber', nodeId: 8 }
    ]
    expect(
      remainingPackErrors(errors, graph, [publication], original, [])
    ).toEqual([errors[1]])
  })
})
