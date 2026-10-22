import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it } from 'vitest'

import { isPartnerApiNode } from '@/components/graph/isPartnerApiNode'
import type { ComfyNodeDefImpl } from '@/core/graph/nodeDef/ComfyNodeDefImpl'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { toNodeId } from '@/types/nodeId'

class PartnerApiNode extends LGraphNode {
  static override nodeData = { name: 'ByteDanceSeedance', api_node: true }
}

class RegularNode extends LGraphNode {
  static override nodeData = { name: 'KSampler', api_node: false }
}

describe('isPartnerApiNode', () => {
  it.for([
    {
      name: 'constructor api_node',
      create: () => new PartnerApiNode('ByteDance Seedance'),
      expected: true
    },
    {
      name: 'regular constructor',
      create: () => new RegularNode('KSampler'),
      expected: false
    },
    {
      name: 'missing node',
      create: () => undefined,
      expected: false
    }
  ])('reads api_node from $name', ({ create, expected }) => {
    expect(isPartnerApiNode(create())).toBe(expected)
  })

  it('reads api_node from the node def store', () => {
    const node = new LGraphNode('StorePartner')
    node.id = toNodeId(3)
    node.type = 'StorePartner'
    useNodeDefStore().nodeDefsByName['StorePartner'] =
      fromPartial<ComfyNodeDefImpl>({
        name: 'StorePartner',
        api_node: true
      })

    expect(isPartnerApiNode(node)).toBe(true)
  })

  it('reads api_node after the node is added to the current graph', () => {
    const node = new PartnerApiNode('ByteDance Seedance')
    node.id = toNodeId(12)
    const graph = new LGraph()
    graph.add(node)
    useCanvasStore().currentGraph = graph

    expect(
      isPartnerApiNode(useCanvasStore().currentGraph?.getNodeById(node.id))
    ).toBe(true)
  })
})
