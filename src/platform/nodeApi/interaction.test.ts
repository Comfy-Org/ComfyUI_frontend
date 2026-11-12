/**
 * The platform half: a host supplies movement, packs observe it.
 *
 * The real layout-store wiring is tested next to the bridge in `renderer/`,
 * because `platform/` cannot import from there — and a test that reached across
 * the layer would be asserting an import the architecture forbids.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ComfyApiError } from './errors'
import {
  createNodeDragEndObserver,
  createNodeMoveObserver,
  provideNodeDragEndSource,
  provideNodeMoveSource,
  resetNodeMoveSource
} from './interaction'
import type { NodeHandle } from './nodeHandle'

const handleFor = (id: string) =>
  ({ id, isDeleted: false }) as unknown as NodeHandle

describe('observing node movement', () => {
  beforeEach(() => resetNodeMoveSource())

  it('refuses rather than silently ignoring when no host wired it', () => {
    // A capability that accepts listeners and never calls them is exactly how
    // `onPreview` shipped broken.
    const onNodeMoved = createNodeMoveObserver(handleFor)
    expect(() => onNodeMoved(() => {})).toThrow(ComfyApiError)
  })

  it('delivers a move to the listener as a handle and a position', () => {
    let emit: ((id: string, p: { x: number; y: number }) => void) | undefined
    provideNodeMoveSource((onMove) => {
      emit = onMove
      return () => (emit = undefined)
    })

    const seen: { id: string; x: number }[] = []
    createNodeMoveObserver(handleFor)((event) =>
      seen.push({ id: event.node.id, x: event.position.x })
    )
    emit?.('7', { x: 120, y: 240 })

    expect(seen).toEqual([{ id: '7', x: 120 }])
  })

  it('drops a move for a node that has since gone', () => {
    let emit: ((id: string, p: { x: number; y: number }) => void) | undefined
    provideNodeMoveSource((onMove) => {
      emit = onMove
      return () => {}
    })

    const seen: unknown[] = []
    createNodeMoveObserver(() => undefined)((event) => seen.push(event))
    emit?.('7', { x: 1, y: 2 })

    expect(seen).toEqual([])
  })

  it('unsubscribes through the host', () => {
    let live = false
    provideNodeMoveSource(() => {
      live = true
      return () => (live = false)
    })

    const stop = createNodeMoveObserver(handleFor)(() => {})
    expect(live).toBe(true)
    stop()
    expect(live).toBe(false)
  })
})

describe('observing completed node drags', () => {
  beforeEach(() => resetNodeMoveSource())

  it('rejects subscriptions before the host provides a source', () => {
    expect(() => createNodeDragEndObserver(handleFor)(() => {})).toThrow(
      ComfyApiError
    )
  })

  it('filters missing and deleted nodes', () => {
    let emit: ((ids: readonly string[]) => void) | undefined
    provideNodeDragEndSource((listener) => {
      emit = listener
      return () => {
        emit = undefined
      }
    })
    const deleted = { id: '2', isDeleted: true } as unknown as NodeHandle
    const listener = vi.fn()
    createNodeDragEndObserver((id) => {
      if (id === '1') return handleFor(id)
      if (id === '2') return deleted
      return undefined
    })(listener)

    emit?.(['1', '2', '3'])

    expect(listener).toHaveBeenCalledWith([
      expect.objectContaining({ id: '1' })
    ])
  })

  it('suppresses delivery when no live nodes remain', () => {
    let emit: ((ids: readonly string[]) => void) | undefined
    provideNodeDragEndSource((listener) => {
      emit = listener
      return () => undefined
    })
    const listener = vi.fn()
    createNodeDragEndObserver(() => undefined)(listener)

    emit?.(['missing'])

    expect(listener).not.toHaveBeenCalled()
  })
})
