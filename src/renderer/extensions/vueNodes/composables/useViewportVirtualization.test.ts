import { createTestingPinia } from '@pinia/testing'
import type * as VueUse from '@vueuse/core'
import { setActivePinia } from 'pinia'
import { effectScope, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  GraphNodeManager,
  VueNodeData
} from '@/composables/graph/useGraphNodeManager'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { toNodeId } from '@/types/nodeId'

import {
  getNodesInViewport,
  rectsOverlap,
  useViewportVirtualization
} from './useViewportVirtualization'

const rafWatcher = vi.hoisted(() => ({
  active: false,
  callback: undefined as Parameters<typeof VueUse.useRafFn>[0] | undefined,
  pause: vi.fn(() => {
    rafWatcher.active = false
  }),
  resume: vi.fn(() => {
    rafWatcher.active = true
  })
}))

vi.mock('@vueuse/core', async (importOriginal) => {
  const vueUse = await importOriginal<typeof VueUse>()
  return {
    ...vueUse,
    useRafFn: vi.fn(
      (
        _callback: Parameters<typeof VueUse.useRafFn>[0],
        options?: Parameters<typeof VueUse.useRafFn>[1]
      ) => {
        rafWatcher.active = options?.immediate ?? true
        rafWatcher.callback = _callback
        return {
          isActive: { value: rafWatcher.active },
          pause: rafWatcher.pause,
          resume: rafWatcher.resume
        }
      }
    )
  }
})

function createNodeData(id: number): VueNodeData {
  return {
    executing: false,
    id: toNodeId(id),
    mode: 0,
    selected: false,
    title: String(id),
    type: 'test'
  }
}

function createNode(id: number, x: number, y: number): LGraphNode {
  const node = new LGraphNode(String(id))
  node.id = toNodeId(id)
  node.pos = [x, y]
  node.size = [100, 80]
  node.updateArea()
  return node
}

describe('viewport virtualization geometry', () => {
  it('treats touching bounds as visible', () => {
    expect(rectsOverlap([0, 0, 100, 100], [100, 40, 20, 20])).toBe(true)
    expect(rectsOverlap([0, 0, 100, 100], [101, 40, 20, 20])).toBe(false)
  })

  it('returns intersecting nodes in graph order without overscan', () => {
    const nodes = [
      createNode(1, 1000, 1000),
      createNode(2, 40, 40),
      createNode(3, -500, -500),
      createNode(4, 10, 10)
    ]
    const nodesById = new Map(nodes.map((node) => [node.id, node]))
    const result = getNodesInViewport(
      [1, 2, 3, 4].map(createNodeData),
      [0, 0, 200, 200],
      (id) => nodesById.get(id)
    )

    expect(Array.from(result)).toEqual([toNodeId(2), toNodeId(4)])
  })
})

describe('viewport virtualization behavior', () => {
  beforeEach(() => {
    rafWatcher.active = false
    rafWatcher.callback = undefined
    rafWatcher.pause.mockClear()
    rafWatcher.resume.mockClear()
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('reactively protects a focused node outside the viewport', () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    const animationFrames = new Map<number, FrameRequestCallback>()
    let nextAnimationFrameId = 1
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        const frameId = nextAnimationFrameId++
        animationFrames.set(frameId, callback)
        return frameId
      })
    )
    vi.stubGlobal(
      'cancelAnimationFrame',
      vi.fn((frameId: number) => animationFrames.delete(frameId))
    )

    function runAnimationFrame(): void {
      const frame = animationFrames.entries().next().value
      if (!frame) throw new Error('No animation frame was scheduled')
      const [frameId, callback] = frame
      animationFrames.delete(frameId)
      callback(0)
    }

    const nodeData = createNodeData(1)
    const scope = effectScope()
    const virtualization = scope.run(() =>
      useViewportVirtualization({
        allNodes: ref([nodeData]),
        canvas: null,
        enabled: true,
        nodeManager: null
      })
    )
    if (!virtualization)
      throw new Error('Failed to create virtualization scope')

    virtualization.onNodeMounted(nodeData.id)
    runAnimationFrame()
    runAnimationFrame()
    expect(virtualization.renderedNodes.value).toEqual([])

    const nodeElement = document.createElement('div')
    nodeElement.dataset.nodeId = nodeData.id
    const input = document.createElement('input')
    nodeElement.appendChild(input)
    document.body.appendChild(nodeElement)
    input.focus()

    expect(virtualization.renderedNodes.value).toEqual([nodeData])
    scope.stop()
  })

  it('only polls canvas transforms while virtualization is enabled', () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    const enabled = ref(false)
    const scope = effectScope()
    scope.run(() =>
      useViewportVirtualization({
        allNodes: [],
        canvas: null,
        enabled,
        nodeManager: null
      })
    )

    expect(rafWatcher.active).toBe(false)

    enabled.value = true
    expect(rafWatcher.active).toBe(true)

    enabled.value = false
    expect(rafWatcher.active).toBe(false)
    scope.stop()
  })

  it('recomputes the viewport after a canvas transform settles', () => {
    vi.useFakeTimers()
    setActivePinia(createTestingPinia({ stubActions: false }))
    const nodeData = createNodeData(1)
    const node = createNode(1, 0, 0)
    const getNode = vi.fn(() => node)
    const computeVisibleArea = vi.fn()
    const canvas = {
      ds: {
        scale: 1,
        offset: [0, 0],
        visible_area: [0, 0, 200, 200],
        computeVisibleArea
      },
      graph: {},
      linkConnector: { renderLinks: [] },
      viewport: [0, 0, 200, 200]
    } as unknown as LGraphCanvas
    const nodeManager = {
      getNode
    } as unknown as GraphNodeManager
    const scope = effectScope()
    scope.run(() =>
      useViewportVirtualization({
        allNodes: [nodeData],
        canvas,
        enabled: true,
        nodeManager
      })
    )
    vi.runAllTimers()
    computeVisibleArea.mockClear()
    getNode.mockClear()

    const callback = rafWatcher.callback
    if (!callback)
      throw new Error('Transform watcher callback was not captured')

    callback({ delta: 0, timestamp: 0 })
    vi.advanceTimersByTime(150)
    expect(computeVisibleArea).toHaveBeenCalledOnce()
    expect(getNode).toHaveBeenCalledWith(nodeData.id)

    callback({ delta: 0, timestamp: 150 })
    vi.advanceTimersByTime(150)
    expect(computeVisibleArea).toHaveBeenCalledOnce()

    canvas.ds.offset[0] = 100
    callback({ delta: 0, timestamp: 300 })
    vi.advanceTimersByTime(149)
    expect(computeVisibleArea).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(1)
    expect(computeVisibleArea).toHaveBeenCalledTimes(2)
    scope.stop()
  })
})
