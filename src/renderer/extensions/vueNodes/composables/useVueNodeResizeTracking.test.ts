import { cleanup, render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, useTemplateRef } from 'vue'

import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { LGraph, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { createTestSubgraphData } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import {
  readMountedNodeSize,
  retireMountedGraphSizes,
  retireMountedNodeSize
} from '@/renderer/core/layout/store/mountedNodeSizes'

import { useMountedNodeSize } from './useVueNodeResizeTracking'

class Observer implements ResizeObserver {
  static live = new Set<Observer>()
  observe = vi.fn()
  unobserve = vi.fn()

  constructor(readonly deliver: ResizeObserverCallback) {
    Observer.live.add(this)
  }

  disconnect() {
    Observer.live.delete(this)
  }

  resize(target: Element, width: number, height: number) {
    const size = { inlineSize: width, blockSize: height }
    this.deliver(
      [
        {
          target,
          borderBoxSize: [size],
          contentBoxSize: [size],
          devicePixelContentBoxSize: [size],
          contentRect: new DOMRect(0, 0, width, height)
        }
      ],
      this
    )
  }
}

const id = toNodeId('node')
const dirty = vi.fn()
const TrackedNode = defineComponent({
  props: { nodeId: { type: String, default: 'node' } },
  setup(props) {
    useMountedNodeSize(
      useTemplateRef<HTMLElement>('node'),
      () => props.nodeId,
      () => 'Note'
    )
    return () => h('div', { ref: 'node', 'data-testid': props.nodeId })
  }
})

async function mountNode(nodeId = 'node') {
  const view = render(TrackedNode, { props: { nodeId } })
  await nextTick()
  const element = screen.getByTestId(nodeId)
  const observer = [...Observer.live][0]
  return { view, element, observer }
}

describe('mounted Vue node measurements', () => {
  let graph: LGraph
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', Observer)
    graph = new LGraph()
    const canvas = useCanvasStore()
    canvas.currentGraph = graph
    canvas.canvas = fromPartial({ graph, setDirty: dirty })
    canvas.linearMode = false
  })

  afterEach(() => {
    cleanup()
  })

  it('shares the observer until the last mounted element leaves', async () => {
    const first = await mountNode()
    const second = await mountNode('second')
    expect(Observer.live.size).toBe(1)
    first.view.unmount()
    expect(Observer.live.size).toBe(1)
    second.view.unmount()
    expect(Observer.live.size).toBe(0)
  })

  it('redraws changed measurements and uses the correct collapse state', async () => {
    const { observer, element } = await mountNode()
    observer.resize(element, 225, 100 + LiteGraph.NODE_TITLE_HEIGHT)
    observer.resize(element, 225, 100 + LiteGraph.NODE_TITLE_HEIGHT)
    expect(readMountedNodeSize(graph, id, { collapsed: false })).toEqual({
      width: 225,
      height: 100
    })
    expect(dirty).toHaveBeenCalledTimes(1)
    element.dataset.collapsed = ''
    observer.resize(element, 136, LiteGraph.NODE_TITLE_HEIGHT)
    expect(readMountedNodeSize(graph, id, { collapsed: false })).toBeUndefined()
    expect(readMountedNodeSize(graph, id, { collapsed: true })).toEqual({
      width: 136,
      height: 0
    })
    delete element.dataset.collapsed
    observer.resize(element, 225, 123 + LiteGraph.NODE_TITLE_HEIGHT)
    expect(readMountedNodeSize(graph, id, { collapsed: false })).toEqual({
      width: 225,
      height: 123
    })
    expect(dirty).toHaveBeenCalledTimes(3)
  })

  it.for([
    { scope: 'node', retire: retireMountedNodeSize },
    { scope: 'graph', retire: retireMountedGraphSizes }
  ])(
    'drops measurements after retiring the $scope before a replacement can be measured',
    async ({ retire }) => {
      const { observer, element } = await mountNode()
      observer.resize(element, 420, 180)
      retire(graph, id)
      observer.resize(element, 420, 180)
      expect(
        readMountedNodeSize(graph, id, { collapsed: false })
      ).toBeUndefined()
      await nextTick()
      const replacementObserver = [...Observer.live][0]
      replacementObserver.resize(element, 225, 150)
      expect(readMountedNodeSize(graph, id, { collapsed: false })?.width).toBe(
        225
      )
    }
  )

  it('does not reuse a measurement when a mounted element moves to another graph', async () => {
    const { observer, element, view } = await mountNode()
    observer.resize(element, 420, 180)
    const next = new LGraph()
    useCanvasStore().currentGraph = next
    await nextTick()
    expect(readMountedNodeSize(graph, id, { collapsed: false })).toBeUndefined()
    expect(readMountedNodeSize(next, id, { collapsed: false })).toBeUndefined()
    ;[...Observer.live][0].resize(element, 225, 150)
    expect(readMountedNodeSize(next, id, { collapsed: false })?.width).toBe(225)
    view.unmount()
    expect(readMountedNodeSize(next, id, { collapsed: false })).toBeUndefined()
  })

  it('keeps mounted measurements when history rebuilds the open subgraph', async () => {
    const original = graph.createSubgraph(createTestSubgraphData())
    const canvasStore = useCanvasStore()
    canvasStore.currentGraph = original
    const { observer, element } = await mountNode()
    observer.resize(element, 420, 180)
    const snapshot = graph.asSerialisable()
    snapshot.definitions = { subgraphs: [original.asSerialisable()] }

    graph.configure(snapshot, undefined, { preserveMountedNodeSizes: true })
    const restored = graph.subgraphs.get(original.id)
    if (!restored || restored === original)
      throw new Error('Expected a rebuilt subgraph')
    canvasStore.currentGraph = restored
    await nextTick()
    expect(readMountedNodeSize(restored, id, { collapsed: false })?.width).toBe(
      420
    )

    graph.configure(snapshot)
    const replacement = graph.subgraphs.get(original.id)
    if (!replacement) throw new Error('Expected a replacement subgraph')
    expect(
      readMountedNodeSize(replacement, id, { collapsed: false })
    ).toBeUndefined()
  })

  it('defers hidden deliveries and ignores unchanged measurements on return', async () => {
    const { observer, element } = await mountNode()
    observer.resize(element, 225, 150)
    const visibility = vi.spyOn(document, 'visibilityState', 'get')
    visibility.mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    observer.resize(element, 420, 180)
    expect(readMountedNodeSize(graph, id, { collapsed: false })?.width).toBe(
      225
    )
    expect(observer.unobserve).toHaveBeenCalledWith(element)
    visibility.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    await nextTick()
    expect(observer.observe).toHaveBeenCalledTimes(2)
    observer.resize(element, 225, 150)
    expect(dirty).toHaveBeenCalledTimes(1)
  })
})
