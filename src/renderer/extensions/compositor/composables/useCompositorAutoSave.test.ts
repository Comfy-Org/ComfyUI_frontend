import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { Dirty } from '@/renderer/extensions/layerEditor/engine/history'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

import { useCompositorAutoSave } from './useCompositorAutoSave'
import {
  clearCompositorLayers,
  setCompositorLayers
} from './useCompositorLayers'

const GRAPH_ID = 'compositor-autosave-test'
const NODE_ID = toNodeId(7)

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

function makeNode(): LGraphNode {
  useWidgetValueStore().registerWidget(
    widgetId(GRAPH_ID, NODE_ID, 'compositor'),
    { type: 'compositor', value: {}, options: {} }
  )
  return createMockLGraphNode({
    id: NODE_ID,
    graph: { rootGraph: { id: GRAPH_ID } }
  })
}

const storedValue = () =>
  useWidgetValueStore().getWidget(widgetId(GRAPH_ID, NODE_ID, 'compositor'))
    ?.value

const cacheNode = createMockLGraphNode({ id: NODE_ID })

beforeEach(() => {
  setCompositorLayers(
    cacheNode,
    [{ filename: 'a.png', subfolder: '', type: 'temp' }],
    ['hash-a']
  )
})

afterEach(() => {
  clearCompositorLayers(cacheNode)
})

describe('useCompositorAutoSave', () => {
  it('leaves the widget untouched when no fingerprint is cached', () => {
    clearCompositorLayers(cacheNode)
    const session = makeSession()
    const node = makeNode()
    useCompositorAutoSave(session, node)

    session.emitHistoryChange()
    vi.advanceTimersByTime(2000)

    expect(useWidgetValueStore().setValue).not.toHaveBeenCalled()
    expect(storedValue()).toEqual({})
  })

  it('debounces history changes into a single widget write', () => {
    const session = makeSession()
    const node = makeNode()
    useCompositorAutoSave(session, node)

    session.emitHistoryChange()
    session.emitHistoryChange()
    session.emitHistoryChange()
    expect(useWidgetValueStore().setValue).not.toHaveBeenCalled()

    vi.advanceTimersByTime(300)
    expect(useWidgetValueStore().setValue).toHaveBeenCalledTimes(1)
    expect(storedValue()).toMatchObject({ canvas: { w: 8, h: 8 } })
  })

  it('saves again for edits after the debounce window', () => {
    const session = makeSession()
    const node = makeNode()
    useCompositorAutoSave(session, node)

    session.emitHistoryChange()
    vi.advanceTimersByTime(300)
    session.emitHistoryChange()
    vi.advanceTimersByTime(300)

    expect(useWidgetValueStore().setValue).toHaveBeenCalledTimes(2)
  })

  it('ignores selection-only history changes', () => {
    const session = makeSession()
    const node = makeNode()
    useCompositorAutoSave(session, node)

    session.emitHistoryChange(Dirty.SELECTION)
    vi.advanceTimersByTime(300)

    expect(useWidgetValueStore().setValue).not.toHaveBeenCalled()
  })

  it('stop() cancels pending saves and unsubscribes', () => {
    const session = makeSession()
    const node = makeNode()
    const autoSave = useCompositorAutoSave(session, node)

    session.emitHistoryChange()
    autoSave.stop()
    vi.advanceTimersByTime(300)

    session.emitHistoryChange()
    vi.advanceTimersByTime(300)

    expect(useWidgetValueStore().setValue).not.toHaveBeenCalled()
  })
})
