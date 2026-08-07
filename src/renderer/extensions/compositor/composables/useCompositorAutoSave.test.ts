import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Dirty } from '@/renderer/extensions/layerEditor/engine/history'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { toNodeId } from '@/types/nodeId'

import {
  clearCompositorLayers,
  setCompositorLayers
} from './useCompositorLayers'
import { useCompositorAutoSave } from './useCompositorAutoSave'

function makeSession() {
  const listeners = new Set<(mask: number) => void>()
  return {
    editor: {
      history: {
        onChange(listener: (mask: number) => void) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        }
      }
    },
    canvasSize: { value: { w: 8, h: 8 } },
    layers: { value: [] },
    layerFlips: () => ({ h: false, v: false }),
    inputLayerIds: () => [],
    emitHistoryChange(mask: number = Dirty.DRAWABLE) {
      for (const listener of listeners) listener(mask)
    }
  }
}

function makeNode() {
  const compositorWidget = {
    name: 'compositor',
    value: {},
    callback: vi.fn()
  } as unknown as IBaseWidget
  const node = {
    id: toNodeId(7),
    widgets: [compositorWidget],
    widgets_values: [{}]
  } as unknown as LGraphNode
  return { node, compositorWidget }
}

beforeEach(() => {
  vi.useFakeTimers()
  setCompositorLayers(
    toNodeId(7),
    [{ filename: 'a.png', subfolder: '', type: 'temp' }],
    ['hash-a']
  )
})

afterEach(() => {
  vi.useRealTimers()
  clearCompositorLayers(toNodeId(7))
})

describe('useCompositorAutoSave', () => {
  it('debounces history changes into a single widget write', () => {
    const session = makeSession()
    const { node, compositorWidget } = makeNode()
    useCompositorAutoSave(session, node)

    session.emitHistoryChange()
    session.emitHistoryChange()
    session.emitHistoryChange()
    expect(compositorWidget.callback).not.toHaveBeenCalled()

    vi.advanceTimersByTime(300)
    expect(compositorWidget.callback).toHaveBeenCalledTimes(1)
    expect(compositorWidget.value).toMatchObject({ canvas: { w: 8, h: 8 } })
  })

  it('saves again for edits after the debounce window', () => {
    const session = makeSession()
    const { node, compositorWidget } = makeNode()
    useCompositorAutoSave(session, node)

    session.emitHistoryChange()
    vi.advanceTimersByTime(300)
    session.emitHistoryChange()
    vi.advanceTimersByTime(300)

    expect(compositorWidget.callback).toHaveBeenCalledTimes(2)
  })

  it('ignores selection-only history changes', () => {
    const session = makeSession()
    const { node, compositorWidget } = makeNode()
    useCompositorAutoSave(session, node)

    session.emitHistoryChange(Dirty.SELECTION)
    vi.advanceTimersByTime(300)

    expect(compositorWidget.callback).not.toHaveBeenCalled()
  })

  it('stop() cancels pending saves and unsubscribes', () => {
    const session = makeSession()
    const { node, compositorWidget } = makeNode()
    const autoSave = useCompositorAutoSave(session, node)

    session.emitHistoryChange()
    autoSave.stop()
    vi.advanceTimersByTime(300)

    session.emitHistoryChange()
    vi.advanceTimersByTime(300)

    expect(compositorWidget.callback).not.toHaveBeenCalled()
  })
})
