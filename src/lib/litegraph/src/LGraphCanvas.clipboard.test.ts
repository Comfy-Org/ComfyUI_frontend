import { describe, expect, it } from 'vitest'

import { LGraph, LGraphNode, createUuidv4 } from '@/lib/litegraph/src/litegraph'
import { remapClipboardSubgraphNodeIds } from '@/lib/litegraph/src/LGraphCanvas'
import type {
  ClipboardItems,
  ExportedSubgraph,
  ISerialisedNode
} from '@/lib/litegraph/src/types/serialisation'
import {
  extractLayoutFromSerialized,
  extractPresentationFromSerialized
} from '@/renderer/core/layout/persistence/layoutPersistenceAdapter'

function createSerialisedNode(
  id: number,
  type: string,
  proxyWidgets?: Array<[string, string]>
): ISerialisedNode {
  return {
    id,
    type,
    pos: [0, 0],
    size: [140, 80],
    flags: {},
    order: 0,
    mode: 0,
    inputs: [],
    outputs: [],
    properties: proxyWidgets ? { proxyWidgets } : {}
  }
}

describe('remapClipboardSubgraphNodeIds', () => {
  it('remaps pasted subgraph interior IDs and proxyWidgets references', () => {
    const rootGraph = new LGraph()
    const existingNode = new LGraphNode('existing')
    existingNode.id = 1
    rootGraph.add(existingNode)

    const subgraphId = createUuidv4()
    const pastedSubgraph: ExportedSubgraph = {
      id: subgraphId,
      version: 1,
      revision: 0,
      state: {
        lastNodeId: 0,
        lastLinkId: 0,
        lastGroupId: 0,
        lastRerouteId: 0
      },
      config: {},
      name: 'Pasted Subgraph',
      inputNode: {
        id: -10,
        bounding: [0, 0, 10, 10]
      },
      outputNode: {
        id: -20,
        bounding: [0, 0, 10, 10]
      },
      inputs: [],
      outputs: [],
      widgets: [],
      nodes: [createSerialisedNode(1, 'test/node')],
      links: [
        {
          id: 1,
          type: '*',
          origin_id: 1,
          origin_slot: 0,
          target_id: 1,
          target_slot: 0
        }
      ],
      groups: []
    }

    const parsed: ClipboardItems = {
      nodes: [createSerialisedNode(99, subgraphId, [['1', 'seed']])],
      groups: [],
      reroutes: [],
      links: [],
      subgraphs: [pastedSubgraph]
    }

    remapClipboardSubgraphNodeIds(parsed, rootGraph)

    const remappedSubgraph = parsed.subgraphs?.[0]
    expect(remappedSubgraph).toBeDefined()

    const remappedLink = remappedSubgraph?.links?.[0]
    expect(remappedLink).toBeDefined()

    const remappedInteriorId = remappedSubgraph?.nodes?.[0]?.id
    expect(remappedInteriorId).not.toBe(1)
    expect(remappedLink?.origin_id).toBe(remappedInteriorId)
    expect(remappedLink?.target_id).toBe(remappedInteriorId)

    const remappedNode = parsed.nodes?.[0]
    expect(remappedNode).toBeDefined()
    expect(remappedNode?.properties?.proxyWidgets).toStrictEqual([
      [String(remappedInteriorId), 'seed']
    ])
  })
})

describe('Serialization layout field preservation', () => {
  it('serialized node preserves pos and size arrays', () => {
    const node = new LGraphNode('test')
    node.pos = [100, 200]
    node.size = [300, 400]

    const serialized = node.serialize()

    expect(serialized.pos).toEqual([100, 200])
    expect(serialized.size).toEqual([300, 400])
  })

  it('serialized node preserves presentation fields', () => {
    const node = new LGraphNode('test')
    node.title = 'Custom Title'
    node.mode = 2
    node.color = '#ff0000'
    node.bgcolor = '#00ff00'

    const serialized = node.serialize()

    expect(serialized.title).toBe('Custom Title')
    expect(serialized.mode).toBe(2)
    expect(serialized.color).toBe('#ff0000')
    expect(serialized.bgcolor).toBe('#00ff00')
  })

  it('serialized node preserves flags', () => {
    const node = new LGraphNode('test')
    node.flags.collapsed = true
    node.flags.pinned = true

    const serialized = node.serialize()

    expect(serialized.flags?.collapsed).toBe(true)
    expect(serialized.flags?.pinned).toBe(true)
  })
})

describe('Layout persistence adapter round-trip', () => {
  it('extractLayoutFromSerialized uses provided zIndex', () => {
    const serializedNode: ISerialisedNode = {
      id: 42,
      type: 'test',
      pos: [10, 20],
      size: [100, 50],
      flags: {},
      order: 0,
      mode: 0
    }

    const layout = extractLayoutFromSerialized(serializedNode, 7)
    expect(layout.zIndex).toBe(7)
    expect(layout.id).toBe('42')
  })

  it('extractPresentationFromSerialized handles missing optional fields', () => {
    const serializedNode: ISerialisedNode = {
      id: 1,
      type: 'test',
      pos: [0, 0],
      size: [100, 100],
      flags: {},
      order: 0,
      mode: 0
    }

    const presentation = extractPresentationFromSerialized(serializedNode)
    expect(presentation.title).toBe('')
    expect(presentation.mode).toBe(0)
    expect(presentation.color).toBeUndefined()
    expect(presentation.bgcolor).toBeUndefined()
    expect(presentation.flags.collapsed).toBeUndefined()
    expect(presentation.flags.pinned).toBeUndefined()
  })
})
