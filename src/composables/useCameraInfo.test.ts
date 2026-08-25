import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, shallowRef } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'
import { fromPartial } from '@total-typescript/shoehorn'

interface ViewportInstance {
  ctorArgs: unknown[]
  applyState: ReturnType<typeof vi.fn>
  setGizmosVisible: ReturnType<typeof vi.fn>
  setTransformGizmoMode: ReturnType<typeof vi.fn>
  setLookThrough: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
  overlay: { getState: ReturnType<typeof vi.fn> }
  viewport: {
    updateStatusMouseOnScene: ReturnType<typeof vi.fn>
    updateStatusMouseOnNode: ReturnType<typeof vi.fn>
    refreshViewport: ReturnType<typeof vi.fn>
  }
}

const { ViewportMock, instances, addAlert } = vi.hoisted(() => {
  const instances: ViewportInstance[] = []
  const ViewportMock = vi.fn(function (...ctorArgs: unknown[]) {
    const instance: ViewportInstance = {
      ctorArgs,
      applyState: vi.fn(),
      setGizmosVisible: vi.fn(),
      setTransformGizmoMode: vi.fn(),
      setLookThrough: vi.fn(),
      remove: vi.fn(),
      overlay: { getState: vi.fn(() => null) },
      viewport: {
        updateStatusMouseOnScene: vi.fn(),
        updateStatusMouseOnNode: vi.fn(),
        refreshViewport: vi.fn()
      }
    }
    instances.push(instance)
    return instance
  })
  return { ViewportMock, instances, addAlert: vi.fn() }
})

vi.mock('@/extensions/core/cameraInfo/CameraInfoViewport', () => ({
  CameraInfoViewport: ViewportMock
}))
vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ addAlert })
}))

import { useCameraInfo } from './useCameraInfo'

const GRAPH_ID = 'use-camera-info-test-graph'

let nodeCounter = 0

function makeNode(values: Record<string, unknown> = {}): LGraphNode {
  nodeCounter += 1
  const nodeId = toNodeId(nodeCounter)
  registerValues(nodeId, values)
  return createMockLGraphNode({
    id: nodeId,
    graph: { rootGraph: { id: GRAPH_ID } }
  })
}

function registerValues(nodeId: NodeId, values: Record<string, unknown>): void {
  const store = useWidgetValueStore()
  for (const [name, value] of Object.entries(values)) {
    store.registerWidget(widgetId(GRAPH_ID, nodeId, name), {
      type: typeof value === 'number' ? 'number' : 'combo',
      value: value as never,
      options: {}
    })
  }
}

function setValue(node: LGraphNode, name: string, value: unknown): void {
  useWidgetValueStore().setValue(
    widgetId(GRAPH_ID, node.id, name),
    value as never
  )
}

beforeEach(() => {
  instances.length = 0
  ViewportMock.mockClear()
  addAlert.mockClear()
})

describe('useCameraInfo', () => {
  it('constructs the viewport from widget state and exposes the mode', () => {
    const node = makeNode({ mode: 'look_at', 'mode.distance': 7 })
    const container = document.createElement('div')
    const camera = useCameraInfo(shallowRef<LGraphNode | null>(node))

    camera.initialize(container)

    expect(ViewportMock).toHaveBeenCalledOnce()
    const [ctorContainer, initialState] = instances[0].ctorArgs as [
      HTMLElement,
      { mode: string; orbit: { distance: number } }
    ]
    expect(ctorContainer).toBe(container)
    expect(initialState.mode).toBe('look_at')
    expect(initialState.orbit.distance).toBe(7)
    expect(camera.mode.value).toBe('look_at')
  })

  it('does nothing when the node is null', () => {
    const camera = useCameraInfo(shallowRef<LGraphNode | null>(null))
    camera.initialize(document.createElement('div'))

    expect(ViewportMock).not.toHaveBeenCalled()
  })

  it('alerts and does not throw when the viewport fails to construct', () => {
    ViewportMock.mockImplementationOnce(() => {
      throw new Error('webgl unavailable')
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const camera = useCameraInfo(
      shallowRef<LGraphNode | null>(makeNode({ mode: 'orbit' }))
    )

    expect(() => camera.initialize(document.createElement('div'))).not.toThrow()
    expect(addAlert).toHaveBeenCalledOnce()

    consoleError.mockRestore()
  })

  it('forwards toolbar actions to the viewport', () => {
    const camera = useCameraInfo(
      shallowRef<LGraphNode | null>(makeNode({ mode: 'orbit' }))
    )
    camera.initialize(document.createElement('div'))

    camera.setGizmosVisible(false)
    camera.setTransformGizmoMode('camera-rotate')
    camera.setLookThrough(true)

    expect(instances[0].setGizmosVisible).toHaveBeenCalledWith(false)
    expect(instances[0].setTransformGizmoMode).toHaveBeenCalledWith(
      'camera-rotate'
    )
    expect(instances[0].setLookThrough).toHaveBeenCalledWith(true)
  })

  it('re-applies state to the viewport when a store value changes', async () => {
    const node = makeNode({ mode: 'orbit', target_x: 0 })
    const camera = useCameraInfo(shallowRef<LGraphNode | null>(node))
    camera.initialize(document.createElement('div'))

    setValue(node, 'target_x', 3)
    await nextTick()

    const applied = instances[0].applyState.mock.lastCall?.[0] as {
      target: { x: number }
    }
    expect(applied.target.x).toBe(3)
  })

  it('skips re-applying state the viewport already holds', async () => {
    const node = makeNode({ mode: 'orbit', target_x: 0 })
    const camera = useCameraInfo(shallowRef<LGraphNode | null>(node))
    camera.initialize(document.createElement('div'))
    instances[0].overlay.getState.mockImplementation(() => ({
      ...(instances[0].ctorArgs[1] as object),
      target: { x: 3, y: 0, z: 0 }
    }))

    setValue(node, 'target_x', 3)
    await nextTick()

    expect(instances[0].applyState).not.toHaveBeenCalled()
  })

  it('updates the exposed mode when the mode widget changes', async () => {
    const node = makeNode({ mode: 'orbit' })
    const camera = useCameraInfo(shallowRef<LGraphNode | null>(node))
    camera.initialize(document.createElement('div'))

    setValue(node, 'mode', 'quaternion')
    await nextTick()

    expect(camera.mode.value).toBe('quaternion')
  })

  it('picks up widgets registered after initialization (mode switch)', async () => {
    const node = makeNode({ mode: 'orbit' })
    const camera = useCameraInfo(shallowRef<LGraphNode | null>(node))
    camera.initialize(document.createElement('div'))

    setValue(node, 'mode', 'quaternion')
    registerValues(node.id, { 'mode.quat_w': 0.5 })
    await nextTick()

    const applied = instances[0].applyState.mock.lastCall?.[0] as {
      quaternion: { quat: { w: number } }
    }
    expect(applied.quaternion.quat.w).toBe(0.5)
  })

  it('routes node hover into the viewport status flags', () => {
    const node = makeNode({ mode: 'orbit' })
    const camera = useCameraInfo(shallowRef<LGraphNode | null>(node))
    camera.initialize(document.createElement('div'))

    camera.handleMouseEnter()
    camera.handleMouseLeave()
    node.onMouseEnter?.(fromPartial({}))

    expect(instances[0].viewport.updateStatusMouseOnScene).toHaveBeenCalledWith(
      true
    )
    expect(instances[0].viewport.updateStatusMouseOnScene).toHaveBeenCalledWith(
      false
    )
    expect(instances[0].viewport.updateStatusMouseOnNode).toHaveBeenCalledWith(
      true
    )
  })

  it('removes the viewport and stops applying store changes on cleanup', async () => {
    const node = makeNode({ mode: 'orbit', target_x: 0 })
    const camera = useCameraInfo(shallowRef<LGraphNode | null>(node))
    camera.initialize(document.createElement('div'))

    camera.cleanup()
    setValue(node, 'target_x', 5)
    await nextTick()

    expect(instances[0].remove).toHaveBeenCalledOnce()
    expect(instances[0].applyState).not.toHaveBeenCalled()
  })

  it('restores the node mouse handlers on cleanup', () => {
    const node = makeNode({ mode: 'orbit' })
    const originalEnter = vi.fn()
    const originalLeave = vi.fn()
    node.onMouseEnter = originalEnter
    node.onMouseLeave = originalLeave
    const camera = useCameraInfo(shallowRef<LGraphNode | null>(node))
    camera.initialize(document.createElement('div'))

    expect(node.onMouseEnter).not.toBe(originalEnter)

    camera.cleanup()

    expect(node.onMouseEnter).toBe(originalEnter)
    expect(node.onMouseLeave).toBe(originalLeave)
  })

  it('applies store changes to the new viewport after re-initialization', async () => {
    const node = makeNode({ mode: 'orbit', target_x: 0 })
    const camera = useCameraInfo(shallowRef<LGraphNode | null>(node))
    camera.initialize(document.createElement('div'))
    camera.cleanup()
    camera.initialize(document.createElement('div'))

    setValue(node, 'target_x', 5)
    await nextTick()

    expect(instances).toHaveLength(2)
    expect(instances[1].applyState).toHaveBeenCalled()
  })
})
