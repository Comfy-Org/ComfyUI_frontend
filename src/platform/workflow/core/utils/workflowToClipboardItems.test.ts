import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it } from 'vitest'

import {
  SUBGRAPH_INPUT_ID,
  SUBGRAPH_OUTPUT_ID
} from '@/lib/litegraph/src/constants'
import type {
  ExportedSubgraph,
  ISerialisedGraph,
  SerialisableGraph
} from '@/lib/litegraph/src/types/serialisation'
import { toLinkId } from '@/types/linkId'
import { toRerouteId } from '@/types/rerouteId'
import { createUuidv4 } from '@/utils/uuid'

import { workflowToClipboardItems } from './workflowToClipboardItems'

function workflowV1(): SerialisableGraph {
  return {
    id: createUuidv4(),
    revision: 0,
    version: 1,
    state: {
      lastGroupId: 0,
      lastNodeId: 0,
      lastLinkId: 1,
      lastRerouteId: 1
    },
    nodes: [],
    links: [
      {
        id: 1,
        origin_id: 1,
        origin_slot: 0,
        target_id: 2,
        target_slot: 0,
        type: 'MODEL',
        parentId: 1
      }
    ],
    reroutes: [{ id: 1, pos: [320, 240], linkIds: [1] }]
  }
}

describe('workflowToClipboardItems', () => {
  it('preserves reroute geometry without mutating the workflow', () => {
    const workflow = workflowV1()
    const items = workflowToClipboardItems(workflow)

    expect(items.reroutes).toEqual([{ id: 1, pos: [320, 240], linkIds: [1] }])

    items.reroutes![0].pos[0] = 999
    expect(workflow.reroutes![0].pos).toEqual([320, 240])
  })

  it('normalizes legacy links and reroutes', () => {
    const workflow: ISerialisedGraph = {
      id: createUuidv4(),
      revision: 0,
      version: 0.4,
      last_node_id: 2,
      last_link_id: 1,
      nodes: [],
      groups: [],
      links: [[1, 1, 0, 2, 0, 'MODEL']],
      extra: {
        linkExtensions: [{ id: toLinkId(1), parentId: toRerouteId(7) }],
        reroutes: [{ id: 7, pos: [40, 50], linkIds: [] }]
      }
    }

    const items = workflowToClipboardItems(workflow)

    expect(items.links).toEqual([
      {
        id: 1,
        origin_id: 1,
        origin_slot: 0,
        target_id: 2,
        target_slot: 0,
        type: 'MODEL',
        parentId: 7
      }
    ])
    expect(items.reroutes).toEqual([{ id: 7, pos: [40, 50], linkIds: [] }])
  })

  it('tolerates a legacy workflow with no links', () => {
    const workflow = fromPartial<ISerialisedGraph>({
      id: createUuidv4(),
      version: 0.4,
      nodes: [],
      groups: [],
      extra: {}
    })

    expect(workflowToClipboardItems(workflow).links).toEqual([])
  })

  it('flattens nested subgraph definitions once', () => {
    const child: ExportedSubgraph = subgraph()
    const parent: ExportedSubgraph = subgraph([child])
    const workflow = {
      ...workflowV1(),
      definitions: { subgraphs: [parent, child] }
    }

    const items = workflowToClipboardItems(workflow)

    expect(items.subgraphs?.map(({ id }) => id)).toEqual([parent.id, child.id])
    expect(items.subgraphs?.every(({ definitions }) => !definitions)).toBe(true)
  })

  it('flattens cyclic subgraph definitions once', () => {
    const child = subgraph()
    const parent = subgraph([child])
    child.definitions = { subgraphs: [parent] }
    const workflow = {
      ...workflowV1(),
      definitions: { subgraphs: [parent] }
    }

    const items = workflowToClipboardItems(workflow)

    expect(items.subgraphs?.map(({ id }) => id)).toEqual([parent.id, child.id])
  })
})

function subgraph(definitions?: ExportedSubgraph[]): ExportedSubgraph {
  return {
    id: createUuidv4(),
    revision: 0,
    version: 1,
    state: {
      lastGroupId: 0,
      lastNodeId: 0,
      lastLinkId: 0,
      lastRerouteId: 0
    },
    name: 'Test subgraph',
    inputNode: {
      id: SUBGRAPH_INPUT_ID,
      bounding: [0, 0, 75, 100]
    },
    outputNode: {
      id: SUBGRAPH_OUTPUT_ID,
      bounding: [0, 0, 75, 100]
    },
    nodes: [],
    groups: [],
    definitions: definitions ? { subgraphs: definitions } : undefined
  }
}
