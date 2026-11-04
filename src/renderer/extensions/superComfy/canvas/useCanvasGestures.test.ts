import { describe, expect, it, vi } from 'vitest'

import type { SuperGraphDocument } from '@/renderer/extensions/superComfy/engine/documentSchema'
import {
  docWith,
  edge,
  ioNode
} from '@/renderer/extensions/superComfy/engine/engineFixtures'
import type { EditEvent } from '@/renderer/extensions/superComfy/engine/types'

import { useCanvasGestures } from './useCanvasGestures'

function placedIo(id: string, x: number, y: number) {
  return { ...ioNode(id, 'image'), x, y }
}

function pointer(type: string, clientX: number, clientY: number, extra = {}) {
  return new PointerEvent(type, { clientX, clientY, button: 0, ...extra })
}

function gesturesOn(doc: SuperGraphDocument) {
  const dispatched: EditEvent[] = []
  const connect = vi.fn(() => ({ ok: true }) as const)
  const gestures = useCanvasGestures({
    doc: () => doc,
    toWorld: ({ clientX, clientY }) => ({ x: clientX, y: clientY }),
    dispatch: (event) => dispatched.push(event),
    connect,
    removeNodes: vi.fn(),
    startPan: vi.fn()
  })
  return { gestures, dispatched, connect }
}

describe('useCanvasGestures', () => {
  it('wires an output to the input it is dropped on', () => {
    const { gestures, connect } = gesturesOn(
      docWith([placedIo('a', 0, 0), placedIo('b', 400, 0)])
    )

    gestures.onPortPointerDown(
      pointer('pointerdown', 240, 24),
      'a',
      'out',
      'out'
    )
    window.dispatchEvent(pointer('pointermove', 300, 30))
    window.dispatchEvent(pointer('pointerup', 403, 26))

    expect(connect).toHaveBeenCalledExactlyOnceWith(
      { node: 'a', port: 'out' },
      { node: 'b', port: 'in' }
    )
    expect(gestures.draft.value).toBeNull()
  })

  it('removes a wire picked up from its input and dropped on empty canvas', () => {
    const { gestures, dispatched, connect } = gesturesOn(
      docWith(
        [placedIo('a', 0, 0), placedIo('b', 400, 0)],
        [edge('a', 'out', 'b', 'in')]
      )
    )

    gestures.onPortPointerDown(pointer('pointerdown', 400, 24), 'b', 'in', 'in')
    window.dispatchEvent(pointer('pointerup', 300, 300))

    expect(dispatched).toEqual([
      { type: 'edgesRemoved', edgeIds: ['a.out>b.in'] }
    ])
    expect(connect).not.toHaveBeenCalled()
  })

  it('moves every selected node by the drag distance', () => {
    const { gestures, dispatched } = gesturesOn(
      docWith([placedIo('a', 0, 0), placedIo('b', 400, 100)])
    )

    gestures.onNodePointerDown(pointer('pointerdown', 10, 10), 'a')
    window.dispatchEvent(pointer('pointerup', 10, 10))
    gestures.onNodePointerDown(
      pointer('pointerdown', 410, 110, { shiftKey: true }),
      'b'
    )
    window.dispatchEvent(pointer('pointermove', 450, 140))
    window.dispatchEvent(pointer('pointerup', 450, 140))

    expect(dispatched).toEqual([
      {
        type: 'nodesMoved',
        moves: [
          { id: 'a', x: 40, y: 30 },
          { id: 'b', x: 440, y: 130 }
        ]
      }
    ])
  })
})
