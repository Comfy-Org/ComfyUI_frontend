import { describe, expect, it } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'

import { useVideoConcatWidget } from './useVideoConcatWidget'

describe('useVideoConcatWidget', () => {
  it('adds a serialized order widget bound to the source group', () => {
    const node = new LGraphNode('ConcatenateVideo')

    const widget = useVideoConcatWidget()(node, {
      type: 'VIDEO_CONCAT',
      name: 'order',
      source: 'videos',
      default: { order: ['video1'] }
    })

    expect(widget.type).toBe('videoconcat')
    expect(widget.value).toEqual({ order: ['video1'] })
    expect(widget.options).toMatchObject({
      source: 'videos',
      serialize: true,
      hideInPanel: true
    })
    expect(node.widgets).toContain(widget)
  })

  it('starts each node with its own empty order', () => {
    const spec = { type: 'VIDEO_CONCAT', name: 'order', source: 'videos' }

    const first = useVideoConcatWidget()(new LGraphNode('a'), spec)
    const second = useVideoConcatWidget()(new LGraphNode('b'), spec)

    expect(first.value).toEqual({ order: [] })
    expect(first.value).not.toBe(second.value)
  })

  it('binds to no source when the spec does not name one', () => {
    const widget = useVideoConcatWidget()(new LGraphNode('a'), {
      type: 'CUSTOM',
      name: 'order'
    })

    expect(widget.options).toMatchObject({ source: '' })
    expect(widget.value).toEqual({ order: [] })
  })
})
