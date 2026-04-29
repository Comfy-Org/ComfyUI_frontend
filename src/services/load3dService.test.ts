import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type Load3d from '@/extensions/core/load3d/Load3d'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useLoad3dService } from '@/services/load3dService'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

const { nodeMap, useLoad3dViewerMock, skeletonCloneMock } = vi.hoisted(() => ({
  nodeMap: new Map<LGraphNode, Load3d>(),
  useLoad3dViewerMock: vi.fn(),
  skeletonCloneMock: vi.fn()
}))

vi.mock('@/composables/useLoad3d', () => ({
  nodeToLoad3dMap: nodeMap
}))

vi.mock('@/composables/useLoad3dViewer', () => ({
  useLoad3dViewer: useLoad3dViewerMock
}))

vi.mock('three/examples/jsm/utils/SkeletonUtils', () => ({
  clone: skeletonCloneMock
}))

// Track every node a test creates so the load3dService singleton's
// internal viewerInstances map can be drained in beforeEach without
// reaching into the module's private state.
const createdNodes = new Set<LGraphNode>()

function makeNode(id: number | string): LGraphNode {
  const node = createMockLGraphNode({ id })
  createdNodes.add(node)
  return node
}

function makeLoad3d(): Load3d {
  return {
    remove: vi.fn()
  } as unknown as Load3d
}

function makeViewer(overrides: Record<string, unknown> = {}) {
  return {
    needApplyChanges: { value: false },
    applyChanges: vi.fn().mockResolvedValue(true),
    cleanup: vi.fn(),
    ...overrides
  }
}

describe('load3dService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    nodeMap.clear()
    const svc = useLoad3dService()
    for (const node of createdNodes) svc.removeViewer(node)
    createdNodes.clear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('singleton', () => {
    it('returns the same instance from useLoad3dService()', () => {
      expect(useLoad3dService()).toBe(useLoad3dService())
    })
  })

  describe('getLoad3d (sync)', () => {
    it('returns null when the load3d module has not been loaded yet', () => {
      // Before any async accessor has been called, the cache is empty.
      // We can't easily simulate "module never loaded" because vi.mock makes
      // it eagerly available, so this test verifies the behavior via missing
      // entries instead.
      const node = makeNode('missing')
      expect(useLoad3dService().getLoad3d(node)).toBeNull()
    })

    it('returns null after async load when the node has no entry in the map', async () => {
      const svc = useLoad3dService()
      // Trigger the async loader so the sync path has a populated cache.
      await svc.getLoad3dAsync(makeNode('anything'))

      expect(svc.getLoad3d(makeNode('still-missing'))).toBeNull()
    })

    it('returns the registered Load3d instance once the map has been populated', async () => {
      const svc = useLoad3dService()
      const node = makeNode('a')
      const load3d = makeLoad3d()
      nodeMap.set(node, load3d)
      await svc.getLoad3dAsync(node)

      expect(svc.getLoad3d(node)).toBe(load3d)
    })
  })

  describe('getLoad3dAsync', () => {
    it('returns the Load3d for a registered node', async () => {
      const svc = useLoad3dService()
      const node = makeNode('async-a')
      const load3d = makeLoad3d()
      nodeMap.set(node, load3d)

      await expect(svc.getLoad3dAsync(node)).resolves.toBe(load3d)
    })

    it('returns null for an unregistered node', async () => {
      const svc = useLoad3dService()
      await expect(
        svc.getLoad3dAsync(makeNode('async-missing'))
      ).resolves.toBeNull()
    })
  })

  describe('getNodeByLoad3d', () => {
    it('finds the node owning a given Load3d instance', async () => {
      const svc = useLoad3dService()
      const node = makeNode('owner')
      const load3d = makeLoad3d()
      nodeMap.set(node, load3d)
      await svc.getLoad3dAsync(node)

      expect(svc.getNodeByLoad3d(load3d)).toBe(node)
    })

    it('returns null when the Load3d instance is not in the map', async () => {
      const svc = useLoad3dService()
      await svc.getLoad3dAsync(makeNode('warmup'))

      expect(svc.getNodeByLoad3d(makeLoad3d())).toBeNull()
    })
  })

  describe('removeLoad3d', () => {
    it('calls remove() on the instance and drops it from the map', async () => {
      const svc = useLoad3dService()
      const node = makeNode('to-remove')
      const load3d = makeLoad3d()
      nodeMap.set(node, load3d)
      await svc.getLoad3dAsync(node)

      svc.removeLoad3d(node)

      expect(load3d.remove).toHaveBeenCalled()
      expect(nodeMap.has(node)).toBe(false)
    })

    it('is a no-op when the node has no registered Load3d', async () => {
      const svc = useLoad3dService()
      await svc.getLoad3dAsync(makeNode('warmup'))

      expect(() => svc.removeLoad3d(makeNode('not-there'))).not.toThrow()
    })
  })

  describe('clear', () => {
    it('removes every registered Load3d', async () => {
      const svc = useLoad3dService()
      const a = makeNode('a')
      const b = makeNode('b')
      const ld1 = makeLoad3d()
      const ld2 = makeLoad3d()
      nodeMap.set(a, ld1)
      nodeMap.set(b, ld2)
      await svc.getLoad3dAsync(a)

      svc.clear()

      expect(nodeMap.size).toBe(0)
      expect(ld1.remove).toHaveBeenCalled()
      expect(ld2.remove).toHaveBeenCalled()
    })
  })

  describe('viewer lifecycle', () => {
    it('getOrCreateViewer creates a viewer on first call and reuses it on subsequent calls', async () => {
      const svc = useLoad3dService()
      const node = makeNode('v1')
      const viewer = makeViewer()
      useLoad3dViewerMock.mockReturnValue(viewer)

      const first = await svc.getOrCreateViewer(node)
      const second = await svc.getOrCreateViewer(node)

      expect(first).toBe(viewer)
      expect(second).toBe(viewer)
      expect(useLoad3dViewerMock).toHaveBeenCalledTimes(1)
      expect(useLoad3dViewerMock).toHaveBeenCalledWith(node)
    })

    it('getOrCreateViewerSync uses the supplied factory once and caches the result', () => {
      const svc = useLoad3dService()
      const node = makeNode('v-sync')
      const viewer = makeViewer()
      const factory = vi.fn().mockReturnValue(viewer)

      const first = svc.getOrCreateViewerSync(
        node,
        factory as unknown as typeof useLoad3dViewerMock
      )
      const second = svc.getOrCreateViewerSync(
        node,
        factory as unknown as typeof useLoad3dViewerMock
      )

      expect(first).toBe(viewer)
      expect(second).toBe(viewer)
      expect(factory).toHaveBeenCalledTimes(1)
    })

    it('removeViewer calls cleanup and forgets the viewer', async () => {
      const svc = useLoad3dService()
      const node = makeNode('v2')
      const viewer = makeViewer()
      useLoad3dViewerMock.mockReturnValue(viewer)
      await svc.getOrCreateViewer(node)

      svc.removeViewer(node)

      expect(viewer.cleanup).toHaveBeenCalled()
      useLoad3dViewerMock.mockClear()
      const fresh = makeViewer()
      useLoad3dViewerMock.mockReturnValue(fresh)
      const result = await svc.getOrCreateViewer(node)
      expect(useLoad3dViewerMock).toHaveBeenCalledTimes(1)
      expect(result).toBe(fresh)
    })

    it('removeViewer is safe when no viewer has been created for the node', () => {
      const svc = useLoad3dService()
      expect(() => svc.removeViewer(makeNode('never'))).not.toThrow()
    })
  })

  describe('handleViewerClose', () => {
    it('removes the viewer without applying changes when none are pending', async () => {
      const svc = useLoad3dService()
      const node = makeNode('close-clean')
      const viewer = makeViewer({ needApplyChanges: { value: false } })
      useLoad3dViewerMock.mockReturnValue(viewer)
      await svc.getOrCreateViewer(node)

      await svc.handleViewerClose(node)

      expect(viewer.applyChanges).not.toHaveBeenCalled()
      expect(viewer.cleanup).toHaveBeenCalled()
    })

    it('applies changes and syncs the node config when changes are pending', async () => {
      const svc = useLoad3dService()
      const syncLoad3dConfig = vi.fn()
      const node = Object.assign(makeNode('close-dirty'), {
        syncLoad3dConfig
      }) as LGraphNode
      const viewer = makeViewer({ needApplyChanges: { value: true } })
      useLoad3dViewerMock.mockReturnValue(viewer)
      await svc.getOrCreateViewer(node)

      await svc.handleViewerClose(node)

      expect(viewer.applyChanges).toHaveBeenCalled()
      expect(syncLoad3dConfig).toHaveBeenCalled()
      expect(viewer.cleanup).toHaveBeenCalled()
    })

    it('skips syncLoad3dConfig when the node does not define it', async () => {
      const svc = useLoad3dService()
      const node = makeNode('close-no-sync')
      const viewer = makeViewer({ needApplyChanges: { value: true } })
      useLoad3dViewerMock.mockReturnValue(viewer)
      await svc.getOrCreateViewer(node)

      await expect(svc.handleViewerClose(node)).resolves.toBeUndefined()
      expect(viewer.applyChanges).toHaveBeenCalled()
      expect(viewer.cleanup).toHaveBeenCalled()
    })
  })

  describe('handleViewportRefresh', () => {
    it('returns silently when the load3d is null', () => {
      expect(() => useLoad3dService().handleViewportRefresh(null)).not.toThrow()
    })

    it('toggles the camera through the opposite type and back, then updates controls', () => {
      const controls = { update: vi.fn() }
      const load3d = {
        handleResize: vi.fn(),
        getCurrentCameraType: vi.fn().mockReturnValue('perspective'),
        toggleCamera: vi.fn(),
        getControlsManager: vi.fn().mockReturnValue({ controls })
      } as unknown as Load3d

      useLoad3dService().handleViewportRefresh(load3d)

      expect(load3d.handleResize).toHaveBeenCalled()
      expect(load3d.toggleCamera).toHaveBeenNthCalledWith(1, 'orthographic')
      expect(load3d.toggleCamera).toHaveBeenNthCalledWith(2, 'perspective')
      expect(controls.update).toHaveBeenCalled()
    })

    it('toggles in the reverse direction when starting from orthographic', () => {
      const controls = { update: vi.fn() }
      const load3d = {
        handleResize: vi.fn(),
        getCurrentCameraType: vi.fn().mockReturnValue('orthographic'),
        toggleCamera: vi.fn(),
        getControlsManager: vi.fn().mockReturnValue({ controls })
      } as unknown as Load3d

      useLoad3dService().handleViewportRefresh(load3d)

      expect(load3d.toggleCamera).toHaveBeenNthCalledWith(1, 'perspective')
      expect(load3d.toggleCamera).toHaveBeenNthCalledWith(2, 'orthographic')
    })
  })
})
