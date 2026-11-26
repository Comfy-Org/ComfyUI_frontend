import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'

import { noteNodeExtension } from '@/extensions/core/noteNode'
import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import { app } from '@/scripts/app'
import type { Comfy, NodeHandle } from '@/platform/nodeApi/v4/types'

vi.mock(import('@/scripts/app'))

const { widgetInputsExtension } = await import('@/extensions/core/widgetInputs')

class PackNote extends LGraphNode {
  static widgetsHoldUserContent = true
}

describe('turning widget saving off', () => {
  let graph: LGraph
  let comfy: Comfy

  beforeEach(async () => {
    await noteNodeExtension.registerCustomNodes?.(app)
    await widgetInputsExtension.registerCustomNodes?.(app)
    LiteGraph.registerNodeType('PackTest/Note', PackNote)
    graph = new LGraph()
    ;({ comfy } = createComfyApi({ getGraph: () => graph }))
  })

  function added(type: string): { node: LGraphNode; handle: NodeHandle } {
    const node = LiteGraph.createNode(type)
    assert(node)
    node.serialize_widgets = true
    graph.add(node)
    const handle = comfy.graph.node(String(node.id))
    assert(handle)
    return { node, handle }
  }

  it.for(['Note', 'MarkdownNote', 'PrimitiveNode', 'PackTest/Note'])(
    'is refused on a %s, whose type says its widget values are the user’s content',
    (type) => {
      const { node, handle } = added(type)

      expect(() => handle.setSerializeWidgets(false)).toThrow(
        /^setSerializeWidgets needs a node whose widget values are not the user’s content/
      )
      expect(node.serialize_widgets).toBe(true)
      expect(handle.setSerializeWidgets(true)).toBe(true)
    }
  )

  it('is applied on a node whose type says nothing, even one named Note', () => {
    LiteGraph.registerNodeType('PackTest/Plain', class extends LGraphNode {})
    const { node, handle } = added('PackTest/Plain')
    const namedNote = new LGraphNode('Note', 'Note')
    graph.add(namedNote)

    expect(handle.setSerializeWidgets(false)).toBe(true)
    expect(node.serialize_widgets).toBe(false)
    expect(
      comfy.graph.node(String(namedNote.id))?.setSerializeWidgets(false)
    ).toBe(true)
  })
})
