import { createTestingPinia } from '@pinia/testing'
import type * as VueUse from '@vueuse/core'
import { setActivePinia } from 'pinia'
import { effectScope, nextTick, ref } from 'vue'
import type { ShallowRef } from 'vue'
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
import { isNodeViewportVirtualized } from './viewportVirtualizationState'

const rafWatcher = vi.hoisted(() => ({
  callback: undefined as Parameters<typeof VueUse.useRafFn>[0] | undefined,
  isActive: undefined as ShallowRef<boolean> | undefined,
  pause: vi.fn(() => {
    if (rafWatcher.isActive) rafWatcher.isActive.value = false
  }),
  resume: vi.fn(() => {
    if (rafWatcher.isActive) rafWatcher.isActive.value = true
  })
}))

vi.mock('@vueuse/core', async (importOriginal) => {
  const vueUse = await importOriginal<typeof VueUse>()
  const { shallowRef } = await import('vue')
  return {
    ...vueUse,
    useRafFn: vi.fn(
      (
        _callback: Parameters<typeof VueUse.useRafFn>[0],
        options?: Parameters<typeof VueUse.useRafFn>[1]
      ) => {
        rafWatcher.callback = _callback
        rafWatcher.isActive = shallowRef(options?.immediate ?? true)
        return {
          isActive: rafWatcher.isActive,
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

function stubAnimationFrames() {
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

  return { animationFrames, runAnimationFrame }
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
    rafWatcher.callback = undefined
    rafWatcher.isActive = undefined
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
    const { runAnimationFrame } = stubAnimationFrames()

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
    expect(isNodeViewportVirtualized(nodeData.id)).toBe(true)

    const nodeElement = document.createElement('div')
    nodeElement.dataset.nodeId = nodeData.id
    const input = document.createElement('input')
    nodeElement.appendChild(input)
    document.body.appendChild(nodeElement)
    input.focus()

    expect(virtualization.renderedNodes.value).toEqual([nodeData])
    expect(isNodeViewportVirtualized(nodeData.id)).toBe(false)

    input.blur()
    window.dispatchEvent(new FocusEvent('focusin'))
    expect(virtualization.renderedNodes.value).toEqual([])
    expect(isNodeViewportVirtualized(nodeData.id)).toBe(true)
    scope.stop()
    expect(isNodeViewportVirtualized(nodeData.id)).toBe(false)
  })

  it('protects numeric link-render node ids', () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    const { runAnimationFrame } = stubAnimationFrames()
    const nodeData = createNodeData(1)
    const linkedNode = createNode(1, 0, 0)
    Object.defineProperty(linkedNode, 'id', { value: 1 })
    const canvas = {
      linkConnector: { renderLinks: [{ node: linkedNode }] }
    } as unknown as LGraphCanvas
    const scope = effectScope()
    const virtualization = scope.run(() =>
      useViewportVirtualization({
        allNodes: [nodeData],
        canvas,
        enabled: true,
        nodeManager: null
      })
    )
    if (!virtualization)
      throw new Error('Failed to create virtualization scope')

    virtualization.onNodeMounted(nodeData.id)
    runAnimationFrame()
    runAnimationFrame()

    expect(virtualization.renderedNodes.value).toEqual([nodeData])
    expect(isNodeViewportVirtualized(nodeData.id)).toBe(false)
    scope.stop()
  })

  it('pauses polling and clears queued work when disabled', () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    const { animationFrames, runAnimationFrame } = stubAnimationFrames()
    const enabled = ref(true)
    const nodeData = createNodeData(1)
    const scope = effectScope()
    const virtualization = scope.run(() =>
      useViewportVirtualization({
        allNodes: [nodeData],
        canvas: null,
        enabled,
        nodeManager: null
      })
    )
    if (!virtualization)
      throw new Error('Failed to create virtualization scope')

    expect(rafWatcher.isActive?.value).toBe(true)
    virtualization.onNodeMounted(nodeData.id)
    runAnimationFrame()
    runAnimationFrame()
    expect(isNodeViewportVirtualized(nodeData.id)).toBe(true)

    enabled.value = false
    expect(rafWatcher.isActive?.value).toBe(false)
    expect(isNodeViewportVirtualized(nodeData.id)).toBe(false)

    enabled.value = true
    window.dispatchEvent(new PointerEvent('pointerup'))
    expect(animationFrames.size).toBeGreaterThan(0)
    enabled.value = false
    expect(animationFrames.size).toBe(0)
    window.dispatchEvent(new PointerEvent('pointerup'))
    expect(animationFrames.size).toBe(0)
    scope.stop()
  })

  it('hydrates a node again when its id is removed and restored', async () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    const { runAnimationFrame } = stubAnimationFrames()
    const nodeData = createNodeData(1)
    const allNodes = ref([nodeData])
    const scope = effectScope()
    const virtualization = scope.run(() =>
      useViewportVirtualization({
        allNodes,
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

    allNodes.value = []
    await nextTick()
    allNodes.value = [nodeData]
    await nextTick()

    expect(virtualization.renderedNodes.value).toEqual([nodeData])
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
