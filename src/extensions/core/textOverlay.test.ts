import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { useExtensionService } from '@/services/extensionService'
import type { ComfyExtension } from '@/types/comfy'

const { state } = vi.hoisted(() => ({
  state: { extension: null as ComfyExtension | null }
}))

vi.mock(import('@/services/extensionService'), () => ({
  useExtensionService: () =>
    fromPartial<ReturnType<typeof useExtensionService>>({
      registerExtension: (ext: ComfyExtension) => {
        state.extension = ext
      }
    })
}))

await import('./textOverlay')

function createNode(comfyClass: string) {
  class Node extends LGraphNode {
    static comfyClass = comfyClass
  }
  const node = new Node(comfyClass)
  node.serialize_widgets = true
  node.addWidget('text', 'text', 'Hello', () => {})
  node.addWidget('number', 'font_size', 5, () => {})
  new LGraph().add(node)
  return node
}

function created(node: LGraphNode) {
  state.extension!.nodeCreated!(node, fromPartial({}))
  return node
}

describe('Comfy.TextOverlay extension', () => {
  it('adds a live preview widget below the TextOverlay inputs', () => {
    const node = created(createNode('TextOverlay'))

    expect(node.widgets?.map((widget) => widget.type)).toEqual([
      'text',
      'number',
      'textoverlaypreview'
    ])
  })

  it('leaves other nodes alone', () => {
    const node = created(createNode('SaveImage'))

    expect(node.widgets).toHaveLength(2)
  })

  it('keeps the preview out of saved workflows and prompts', () => {
    const node = created(createNode('TextOverlay'))
    const preview = node.widgets!.at(-1)!

    expect(node.serialize().widgets_values).toEqual(['Hello', 5])
    expect(preview.options.serialize).toBe(false)
  })

  it('grows the node so the preview has room', () => {
    const node = created(createNode('TextOverlay'))

    expect(node.size[0]).toBeGreaterThanOrEqual(360)
    expect(node.size[1]).toBeGreaterThanOrEqual(560)
  })
})
