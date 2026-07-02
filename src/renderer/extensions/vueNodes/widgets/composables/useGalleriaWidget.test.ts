import { describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useGalleriaWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useGalleriaWidget'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

function createMockNode(): {
  node: LGraphNode
  addWidget: ReturnType<typeof vi.spyOn>
} {
  const node = new LGraphNode('TestGalleriaNode')
  const addWidget = vi
    .spyOn(node, 'addWidget')
    .mockImplementation((type, name, value, _callback, options) => {
      const widget = {
        type,
        name,
        value,
        options: typeof options === 'string' ? { property: options } : options,
        y: 0
      } as IBaseWidget
      node.widgets ??= []
      node.widgets.push(widget)
      return widget
    })
  return { node, addWidget }
}

function createGalleriaSpec(images?: string[]): InputSpec {
  return { type: 'GALLERIA', name: 'gallery', images } as InputSpec
}

describe('useGalleriaWidget', () => {
  it('uses the declared images from the input spec', () => {
    const { node, addWidget } = createMockNode()
    const images = ['a.png', 'b.png']

    const widget = useGalleriaWidget()(node, createGalleriaSpec(images))

    expect(addWidget).toHaveBeenCalledWith(
      'galleria',
      'gallery',
      images,
      expect.any(Function),
      { serialize: true }
    )
    expect(widget.value).toBe(images)
  })

  it('defaults to an empty image list', () => {
    const { node, addWidget } = createMockNode()

    const widget = useGalleriaWidget()(node, createGalleriaSpec())

    expect(addWidget).toHaveBeenCalledWith(
      'galleria',
      'gallery',
      [],
      expect.any(Function),
      { serialize: true }
    )
    expect(widget.type).toBe('galleria')
  })

  it('throws when the input spec is not a galleria spec', () => {
    const { node } = createMockNode()
    const inputSpec = {
      type: 'STRING',
      name: 'gallery'
    } as unknown as InputSpec

    expect(() => useGalleriaWidget()(node, inputSpec)).toThrow(
      'Invalid input spec for galleria widget'
    )
  })
})
