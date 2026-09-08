import { describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

import { useVideoEditWidget } from './useVideoEditWidget'

function createNode(widgetType = 'videoedit') {
  const addWidget = vi.fn(
    (
      type: string,
      name: string,
      value: unknown,
      _cb: unknown,
      options: unknown
    ) => ({
      type: widgetType === 'videoedit' ? type : widgetType,
      name,
      value,
      options
    })
  )
  return { node: { addWidget } as unknown as LGraphNode, addWidget }
}

describe('useVideoEditWidget', () => {
  it('creates default sections for all features', () => {
    const { node, addWidget } = createNode()

    useVideoEditWidget()(node, { type: 'VIDEO_EDIT', name: 'edit' })

    const [type, name, value, , options] = addWidget.mock.calls[0]
    expect(type).toBe('videoedit')
    expect(name).toBe('edit')
    expect(value).toEqual({
      trim: { start_time: 0, duration: 0 },
      crop: { x: 0, y: 0, width: 0, height: 0 }
    })
    expect(options).toMatchObject({
      features: ['trim', 'crop'],
      serialize: true,
      canvasOnly: false,
      hideInPanel: true
    })
  })

  it('only creates the sections listed in features', () => {
    const { node, addWidget } = createNode()

    useVideoEditWidget()(node, {
      type: 'VIDEO_EDIT',
      name: 'trim',
      features: ['trim']
    })

    const [, , value, , options] = addWidget.mock.calls[0]
    expect(value).toEqual({ trim: { start_time: 0, duration: 0 } })
    expect(options).toMatchObject({ features: ['trim'] })
  })

  it('prefers an explicit default value from the spec', () => {
    const { node, addWidget } = createNode()

    useVideoEditWidget()(node, {
      type: 'VIDEO_EDIT',
      name: 'edit',
      default: { trim: { start_time: 1.5, duration: 2 } }
    })

    const [, , value] = addWidget.mock.calls[0]
    expect(value).toEqual({ trim: { start_time: 1.5, duration: 2 } })
  })

  it('throws when the node produces an unexpected widget type', () => {
    const { node } = createNode('number')

    expect(() =>
      useVideoEditWidget()(node, { type: 'VIDEO_EDIT', name: 'edit' })
    ).toThrow('Unexpected widget type')
  })
})
