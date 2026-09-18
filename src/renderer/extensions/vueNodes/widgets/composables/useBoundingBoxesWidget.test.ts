import { describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

import { useBoundingBoxesWidget } from './useBoundingBoxesWidget'

const widgetOptions = { serialize: true, hideInPanel: true }

function mockNode() {
  const node = new LGraphNode('Test')
  const addWidget = vi.spyOn(node, 'addWidget')
  return { node, addWidget }
}

describe('useBoundingBoxesWidget', () => {
  it('adds a boundingboxes widget seeded with the spec default', () => {
    const { node, addWidget } = mockNode()
    const boxes = [
      {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        metadata: { type: 'obj', text: '', desc: '', palette: [] }
      }
    ]
    useBoundingBoxesWidget()(node, {
      type: 'BOUNDING_BOXES',
      name: 'editor_state',
      default: boxes
    } as InputSpec)
    expect(addWidget).toHaveBeenCalledWith(
      'boundingboxes',
      'editor_state',
      boxes,
      null,
      widgetOptions
    )
  })

  it('defaults to an empty box list', () => {
    const { node, addWidget } = mockNode()
    useBoundingBoxesWidget()(node, {
      type: 'BOUNDING_BOXES',
      name: 'editor_state'
    } as InputSpec)
    expect(addWidget).toHaveBeenCalledWith(
      'boundingboxes',
      'editor_state',
      [],
      null,
      widgetOptions
    )
  })

  it('deep-clones the spec default so edits never leak into shared state', () => {
    const { node, addWidget } = mockNode()
    const shared = [
      {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        metadata: { type: 'obj', text: '', desc: '', palette: ['#fff'] }
      }
    ]
    useBoundingBoxesWidget()(node, {
      type: 'BOUNDING_BOXES',
      name: 'editor_state',
      default: shared
    } as InputSpec)
    const passed = addWidget.mock.calls[0][2] as typeof shared
    expect(passed).not.toBe(shared)
    expect(passed[0]).not.toBe(shared[0])
    expect(passed[0].metadata.palette).not.toBe(shared[0].metadata.palette)
    expect(passed).toEqual(shared)
  })
})
