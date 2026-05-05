import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'

import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'

import { useMissingMediaPreviewSync } from './useMissingMediaPreviewSync'

const mockRemoveNodeOutputs = vi.hoisted(() => vi.fn())
vi.mock('@/stores/nodeOutputStore', () => ({
  useNodeOutputStore: () => ({ removeNodeOutputs: mockRemoveNodeOutputs })
}))

const mockApp = vi.hoisted(() => ({
  isGraphReady: true,
  rootGraph: undefined as unknown
}))
vi.mock('@/scripts/app', () => ({
  app: mockApp
}))

const mockGetNodeByExecutionId = vi.hoisted(() => vi.fn())
vi.mock('@/utils/graphTraversalUtil', () => ({
  getNodeByExecutionId: mockGetNodeByExecutionId
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({ currentGraph: null })
}))

function makeNode(id: number): LGraphNode {
  const setDirtyCanvas = vi.fn()
  return {
    id,
    imgs: [{ src: 'blob:stale' }],
    videoContainer: { foo: 'bar' },
    graph: { setDirtyCanvas }
  } as unknown as LGraphNode
}

describe('FE-230 useMissingMediaPreviewSync', () => {
  let scope: ReturnType<typeof effectScope>

  beforeEach(() => {
    setActivePinia(createPinia())
    mockApp.isGraphReady = true
    mockApp.rootGraph = { _nodes: [] } as unknown as LGraph
    mockRemoveNodeOutputs.mockReset()
    mockGetNodeByExecutionId.mockReset()
    scope = effectScope()
  })

  afterEach(() => {
    scope.stop()
  })

  it('clears preview state for each missing-media candidate node', async () => {
    const node1 = makeNode(11)
    const node2 = makeNode(12)
    mockGetNodeByExecutionId.mockImplementation((_g, id: string) =>
      id === '11' ? node1 : id === '12' ? node2 : null
    )

    const store = useMissingMediaStore()
    scope.run(() => useMissingMediaPreviewSync(store))

    store.setMissingMedia([
      {
        nodeId: '11',
        nodeType: 'LoadImage',
        widgetName: 'image',
        mediaType: 'image',
        name: 'a.png',
        isMissing: true
      },
      {
        nodeId: '12',
        nodeType: 'LoadVideo',
        widgetName: 'file',
        mediaType: 'video',
        name: 'b.mp4',
        isMissing: true
      }
    ])
    await nextTick()

    expect(mockRemoveNodeOutputs).toHaveBeenCalledWith(11)
    expect(mockRemoveNodeOutputs).toHaveBeenCalledWith(12)
    expect(node1.imgs).toBeUndefined()
    expect(node1.videoContainer).toBeUndefined()
    expect(node2.imgs).toBeUndefined()
    expect(node2.videoContainer).toBeUndefined()
  })

  it('deduplicates clears when two candidates target the same node (e.g. multi-widget)', async () => {
    const node = makeNode(7)
    mockGetNodeByExecutionId.mockReturnValue(node)

    const store = useMissingMediaStore()
    scope.run(() => useMissingMediaPreviewSync(store))

    store.setMissingMedia([
      {
        nodeId: '7',
        nodeType: 'LoadImage',
        widgetName: 'image',
        mediaType: 'image',
        name: 'x.png',
        isMissing: true
      },
      {
        nodeId: '7',
        nodeType: 'LoadImage',
        widgetName: 'mask',
        mediaType: 'image',
        name: 'x.png',
        isMissing: true
      }
    ])
    await nextTick()

    expect(mockRemoveNodeOutputs).toHaveBeenCalledTimes(1)
    expect(mockRemoveNodeOutputs).toHaveBeenCalledWith(7)
  })

  it('does nothing when graph is not ready', async () => {
    mockApp.isGraphReady = false
    const store = useMissingMediaStore()
    scope.run(() => useMissingMediaPreviewSync(store))

    store.setMissingMedia([
      {
        nodeId: '5',
        nodeType: 'LoadImage',
        widgetName: 'image',
        mediaType: 'image',
        name: 'a.png',
        isMissing: true
      }
    ])
    await nextTick()

    expect(mockRemoveNodeOutputs).not.toHaveBeenCalled()
  })

  it('skips candidates that do not resolve to a node', async () => {
    mockGetNodeByExecutionId.mockReturnValue(null)
    const store = useMissingMediaStore()
    scope.run(() => useMissingMediaPreviewSync(store))

    store.setMissingMedia([
      {
        nodeId: 'unknown',
        nodeType: 'LoadImage',
        widgetName: 'image',
        mediaType: 'image',
        name: 'a.png',
        isMissing: true
      }
    ])
    await nextTick()

    expect(mockRemoveNodeOutputs).not.toHaveBeenCalled()
  })

  it('runs again when candidates change (e.g. after re-verification)', async () => {
    const nodeA = makeNode(1)
    const nodeB = makeNode(2)
    mockGetNodeByExecutionId.mockImplementation((_g, id: string) =>
      id === '1' ? nodeA : id === '2' ? nodeB : null
    )
    const store = useMissingMediaStore()
    scope.run(() => useMissingMediaPreviewSync(store))

    store.setMissingMedia([
      {
        nodeId: '1',
        nodeType: 'LoadImage',
        widgetName: 'image',
        mediaType: 'image',
        name: 'a.png',
        isMissing: true
      }
    ])
    await nextTick()
    expect(mockRemoveNodeOutputs).toHaveBeenLastCalledWith(1)

    store.setMissingMedia([
      {
        nodeId: '2',
        nodeType: 'LoadImage',
        widgetName: 'image',
        mediaType: 'image',
        name: 'b.png',
        isMissing: true
      }
    ])
    await nextTick()
    expect(mockRemoveNodeOutputs).toHaveBeenLastCalledWith(2)
  })
})
