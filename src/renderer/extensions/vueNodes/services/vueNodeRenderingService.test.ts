import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createVueNodeRenderingService,
  vueNodeRenderingApi
} from '@/renderer/extensions/vueNodes/services/vueNodeRenderingService'
import type { VueNodeRenderArea } from '@/types/vueNodeRendering'

const GRAPH_A = {}
const GRAPH_B = {}

function runtime(
  graph: object | null = GRAPH_A,
  options: {
    frontendRequiredNodeIds?: readonly string[]
    renderFrozen?: boolean
  } = {}
) {
  return {
    graph,
    managerAvailable: graph !== null,
    nodes: graph
      ? [
          {
            id: '1',
            renderArea: [10, 20, 100, 80] as VueNodeRenderArea
          },
          {
            id: '2',
            renderArea: [200, 20, 100, 80] as VueNodeRenderArea
          },
          {
            id: '3',
            renderArea: [390, 20, 100, 80] as VueNodeRenderArea
          }
        ]
      : [],
    visibleCanvasArea: graph ? ([0, 0, 320, 240] as VueNodeRenderArea) : null,
    frontendRequiredNodeIds: options.frontendRequiredNodeIds ?? [],
    renderFrozen: options.renderFrozen ?? false
  }
}

function initializeAll(
  service: ReturnType<typeof createVueNodeRenderingService>
) {
  service.nodeMounted('1')
  service.nodeMounted('2')
  service.nodeMounted('3')
}

describe('vueNodeRenderingService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps internal lifecycle operations off the public API', () => {
    expect(Object.keys(vueNodeRenderingApi).sort()).toEqual([
      'createPolicyController',
      'createPushController',
      'getNodeRenderState',
      'getSnapshot',
      'subscribe'
    ])
  })

  it('renders every node by default and protects nodes until first mount', async () => {
    const service = createVueNodeRenderingService()
    service.updateRuntime(runtime())
    const controller = service.createPushController('viewport')

    controller.update({ suppress: ['1', '2', '3'] })
    expect(service.getSnapshot().renderedNodeIds).toEqual(['1', '2', '3'])

    service.nodeMounted('1')
    await Promise.resolve()
    expect(service.getSnapshot().renderedNodeIds).toEqual(['2', '3'])
    service.nodeMounted('2')
    service.nodeMounted('3')
    await Promise.resolve()

    expect(service.getSnapshot()).toMatchObject({
      renderedNodeIds: [],
      suppressedNodeIds: ['1', '2', '3'],
      initializedNodeIds: ['1', '2', '3']
    })
  })

  it('combines multiple owners with retention taking precedence', () => {
    const service = createVueNodeRenderingService()
    service.updateRuntime(runtime())
    initializeAll(service)
    const viewport = service.createPushController('viewport')
    const inspector = service.createPushController('inspector')

    viewport.update({ suppress: ['1', '2'] })
    inspector.update({ suppress: ['3'], retain: ['2'] })

    expect(service.getSnapshot()).toMatchObject({
      renderedNodeIds: ['2'],
      suppressedNodeIds: ['1', '3'],
      contributionOwners: ['viewport', 'inspector']
    })
    expect(service.getNodeRenderState(1)).toBe('suppressed')
    expect(service.getNodeRenderState('2')).toBe('rendered')
  })

  it('isolates owner updates, clearing, disposal, and duplicate names', () => {
    const service = createVueNodeRenderingService()
    service.updateRuntime(runtime())
    initializeAll(service)
    const first = service.createPushController('first')
    const second = service.createPushController('second')
    first.update({ suppress: ['1'] })
    second.update({ suppress: ['2'] })

    first.clear()
    expect(service.getSnapshot().suppressedNodeIds).toEqual(['2'])
    first.update({ suppress: ['3'] })
    first.dispose()
    expect(service.getSnapshot().suppressedNodeIds).toEqual(['2'])
    expect(() => service.createPushController('second')).toThrow(
      'already registered'
    )

    second.dispose()
    expect(service.getSnapshot().renderedNodeIds).toEqual(['1', '2', '3'])
  })

  it('re-evaluates policies on invalidation and fails open on errors', () => {
    const service = createVueNodeRenderingService()
    service.updateRuntime(runtime())
    initializeAll(service)
    let suppressed = ['1']
    const error = new Error('policy failed')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const policy = service.createPolicyController('policy', () => ({
      suppress: suppressed
    }))
    service.createPolicyController('broken', () => {
      throw error
    })

    expect(service.getSnapshot().suppressedNodeIds).toEqual(['1'])
    suppressed = ['2']
    policy.invalidate()
    expect(service.getSnapshot().suppressedNodeIds).toEqual(['2'])
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('broken'),
      error
    )
  })

  it('publishes copied, deeply frozen snapshots and supports unsubscribe', () => {
    const service = createVueNodeRenderingService()
    const sourceArea: VueNodeRenderArea = [10, 20, 100, 80]
    const listener = vi.fn()
    const unsubscribe = service.subscribe(listener)
    service.updateRuntime({
      ...runtime(),
      nodes: [{ id: '1', renderArea: sourceArea }]
    })
    const snapshot = service.getSnapshot()

    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.nodeIds)).toBe(true)
    expect(Object.isFrozen(snapshot.renderAreas)).toBe(true)
    expect(Object.isFrozen(snapshot.renderAreas[0])).toBe(true)
    expect(Object.isFrozen(snapshot.renderAreas[0].area)).toBe(true)
    expect(snapshot.renderAreas[0].area).not.toBe(sourceArea)
    expect(snapshot.visibleCanvasArea).toEqual([0, 0, 320, 240])
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    service.nodeMounted('1')
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('tracks mounted and initialized lifecycle independently', async () => {
    const service = createVueNodeRenderingService()
    service.updateRuntime(runtime())

    service.nodeMounted('2')
    await Promise.resolve()
    expect(service.getSnapshot()).toMatchObject({
      mountedNodeIds: ['2'],
      initializedNodeIds: ['2']
    })
    service.nodeUnmounted('2')
    await Promise.resolve()
    expect(service.getSnapshot()).toMatchObject({
      mountedNodeIds: [],
      initializedNodeIds: ['2']
    })
    service.nodeMounted('2')
    await Promise.resolve()
    expect(service.getSnapshot().mountedNodeIds).toEqual(['2'])
  })

  it('coalesces lifecycle notifications with the latest mounted state', async () => {
    const service = createVueNodeRenderingService()
    service.updateRuntime(runtime())
    const listener = vi.fn()
    service.subscribe(listener)
    listener.mockClear()

    service.nodeMounted('1')
    service.nodeMounted('2')
    service.nodeMounted('3')

    expect(listener).not.toHaveBeenCalled()
    await Promise.resolve()
    expect(listener).toHaveBeenCalledOnce()
    expect(service.getSnapshot().mountedNodeIds).toEqual(['1', '2', '3'])

    listener.mockClear()
    service.nodeUnmounted('1')
    service.nodeUnmounted('2')
    service.nodeUnmounted('missing')

    expect(listener).not.toHaveBeenCalled()
    await Promise.resolve()
    expect(listener).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({ mountedNodeIds: ['3'] })
    )
  })

  it('keeps frontend-required nodes rendered and freezes suppression changes', () => {
    const service = createVueNodeRenderingService()
    service.updateRuntime(runtime())
    initializeAll(service)
    const controller = service.createPushController('interaction-test')
    controller.update({ suppress: ['1'] })
    expect(service.getSnapshot().suppressedNodeIds).toEqual(['1'])

    service.updateRuntime(
      runtime(GRAPH_A, {
        frontendRequiredNodeIds: ['1'],
        renderFrozen: true
      })
    )
    controller.update({ suppress: ['1', '2', '3'] })
    expect(service.getSnapshot()).toMatchObject({
      renderFrozen: true,
      renderedNodeIds: ['1', '2', '3']
    })

    service.updateRuntime(runtime())
    expect(service.getSnapshot()).toMatchObject({
      renderFrozen: false,
      renderedNodeIds: [],
      suppressedNodeIds: ['1', '2', '3']
    })
  })

  it('increments graph revisions and resets stale push contributions', () => {
    const service = createVueNodeRenderingService()
    service.updateRuntime(runtime())
    initializeAll(service)
    const controller = service.createPushController('push')
    controller.update({ suppress: ['1'] })
    const firstRevision = service.getSnapshot().graphRevision

    service.updateRuntime(runtime())
    expect(service.getSnapshot().graphRevision).toBe(firstRevision)
    service.updateRuntime(runtime(GRAPH_B))

    expect(service.getSnapshot()).toMatchObject({
      graphRevision: firstRevision + 1,
      renderedNodeIds: ['1', '2', '3'],
      suppressedNodeIds: []
    })
  })

  it('ignores unknown IDs and prunes deleted IDs from contributions', () => {
    const service = createVueNodeRenderingService()
    service.updateRuntime(runtime())
    initializeAll(service)
    const controller = service.createPushController('pruning')
    controller.update({ suppress: ['1', 'missing'], retain: ['unknown'] })

    expect(service.getNodeRenderState('missing')).toBe('unknown')
    expect(service.getSnapshot().suppressedNodeIds).toEqual(['1'])

    service.updateRuntime({
      ...runtime(),
      nodes: runtime().nodes.filter((node) => node.id !== '1')
    })
    expect(service.getSnapshot()).toMatchObject({
      nodeIds: ['2', '3'],
      suppressedNodeIds: []
    })
  })
})
