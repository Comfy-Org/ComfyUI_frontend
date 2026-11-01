import { describe, expect, it, vi } from 'vitest'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { widgetId } from '@comfyorg/graph-model/widgetId'
import {
  getDragItemKey,
  getEdgeTriZone,
  getUngroupedEdge,
  isCurrentWorkflowDrag
} from './useGroupDrop'

const id = widgetId('root', toNodeId(1), 'steps')

function makeElement(top: number, height: number): HTMLElement {
  const element = document.createElement('div')
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, top, 100, height)
  )
  return element
}

describe('getDragItemKey', () => {
  it('accepts a canonical widget ID from the shared drag source', () => {
    expect(getDragItemKey({ type: 'group-item', itemKey: id })).toBe(id)
  })

  it.for([
    { type: 'different', itemKey: id },
    { type: 'group-item', itemKey: 'legacy:missing' },
    { type: 'group-item', itemKey: 12 },
    {}
  ])('rejects non-widget drag data: %j', (data) => {
    expect(getDragItemKey(data)).toBeNull()
  })
})

describe('workflow ownership', () => {
  it('accepts a drag from the same active workflow', () => {
    const workflow = { path: 'a.json' }
    expect(isCurrentWorkflowDrag({ workflow }, workflow)).toBe(true)
  })

  it('rejects a drag when the workflow changes', () => {
    expect(
      isCurrentWorkflowDrag(
        { workflow: { path: 'a.json' } },
        { path: 'a.json' }
      )
    ).toBe(false)
  })

  it('rejects a drag if no workflow is active', () => {
    expect(isCurrentWorkflowDrag({ workflow: undefined }, undefined)).toBe(false)
  })
})

describe('drop zones', () => {
  it.for([
    { y: 110, result: 'before' },
    { y: 145, result: 'center' },
    { y: 180, result: 'after' }
  ] as const)('returns $result for group y=$y', ({ y, result }) => {
    expect(getEdgeTriZone(makeElement(100, 90), y)).toBe(result)
  })

  it.for([
    { y: 110, result: 'before' },
    { y: 150, result: 'after' }
  ] as const)('returns $result for main list y=$y', ({ y, result }) => {
    expect(getUngroupedEdge(makeElement(100, 90), y)).toBe(result)
  })
})
