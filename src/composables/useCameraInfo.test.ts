import { ref } from 'vue'
import type { Ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

interface ViewportInstance {
  ctorArgs: unknown[]
  applyState: ReturnType<typeof vi.fn>
  setGizmosVisible: ReturnType<typeof vi.fn>
  setTransformGizmoMode: ReturnType<typeof vi.fn>
  setLookThrough: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
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

interface FakeWidget {
  name: string
  value: unknown
  callback?: (value: unknown, ...rest: unknown[]) => void
}

interface FakeNode {
  widgets: FakeWidget[]
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

function makeNode(values: Record<string, unknown>): FakeNode {
  return {
    widgets: Object.entries(values).map(([name, value]) => ({ name, value }))
  }
}

function widget(node: FakeNode, name: string): FakeWidget {
  const found = node.widgets.find((w) => w.name === name)
  if (!found) throw new Error(`missing widget ${name}`)
  return found
}

function nodeRef(node: FakeNode) {
  return ref(node) as unknown as Ref<LGraphNode | null>
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
    const camera = useCameraInfo(nodeRef(node))

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
    const camera = useCameraInfo(ref(null))
    camera.initialize(document.createElement('div'))

    expect(ViewportMock).not.toHaveBeenCalled()
  })

  it('alerts and does not throw when the viewport fails to construct', () => {
    ViewportMock.mockImplementationOnce(() => {
      throw new Error('webgl unavailable')
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const camera = useCameraInfo(nodeRef(makeNode({ mode: 'orbit' })))

    expect(() => camera.initialize(document.createElement('div'))).not.toThrow()
    expect(addAlert).toHaveBeenCalledOnce()

    consoleError.mockRestore()
  })

  it('forwards toolbar actions to the viewport', () => {
    const camera = useCameraInfo(nodeRef(makeNode({ mode: 'orbit' })))
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

  it('re-applies state to the viewport when a widget changes, keeping the original callback', () => {
    const node = makeNode({ mode: 'orbit', target_x: 0 })
    const original = vi.fn()
    widget(node, 'target_x').callback = original
    const camera = useCameraInfo(nodeRef(node))
    camera.initialize(document.createElement('div'))

    const targetX = widget(node, 'target_x')
    targetX.value = 3
    targetX.callback!(3)

    expect(original).toHaveBeenCalledWith(3)
    const applied = instances[0].applyState.mock.lastCall?.[0] as {
      target: { x: number }
    }
    expect(applied.target.x).toBe(3)
  })

  it('updates the mode ref when the mode widget changes', () => {
    const node = makeNode({ mode: 'orbit' })
    const camera = useCameraInfo(nodeRef(node))
    camera.initialize(document.createElement('div'))

    const modeWidget = widget(node, 'mode')
    modeWidget.value = 'quaternion'
    modeWidget.callback!('quaternion')

    expect(camera.mode.value).toBe('quaternion')
  })

  it('routes node hover into the viewport status flags', () => {
    const node = makeNode({ mode: 'orbit' })
    const camera = useCameraInfo(nodeRef(node))
    camera.initialize(document.createElement('div'))

    camera.handleMouseEnter()
    camera.handleMouseLeave()
    node.onMouseEnter?.()

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

  it('removes the viewport and restores widget callbacks on cleanup', () => {
    const node = makeNode({ mode: 'orbit', target_x: 0 })
    const original = vi.fn()
    widget(node, 'target_x').callback = original
    const camera = useCameraInfo(nodeRef(node))
    camera.initialize(document.createElement('div'))

    camera.cleanup()

    expect(instances[0].remove).toHaveBeenCalledOnce()
    expect(widget(node, 'target_x').callback).toBe(original)
  })

  it('restores the node mouse handlers on cleanup', () => {
    const node = makeNode({ mode: 'orbit' })
    const originalEnter = vi.fn()
    const originalLeave = vi.fn()
    node.onMouseEnter = originalEnter
    node.onMouseLeave = originalLeave
    const camera = useCameraInfo(nodeRef(node))
    camera.initialize(document.createElement('div'))

    expect(node.onMouseEnter).not.toBe(originalEnter)

    camera.cleanup()

    expect(node.onMouseEnter).toBe(originalEnter)
    expect(node.onMouseLeave).toBe(originalLeave)
  })

  it('re-wires widgets on a second initialize after cleanup', () => {
    const node = makeNode({ mode: 'orbit', target_x: 0 })
    const camera = useCameraInfo(nodeRef(node))
    camera.initialize(document.createElement('div'))
    camera.cleanup()
    camera.initialize(document.createElement('div'))

    const targetX = widget(node, 'target_x')
    targetX.value = 5
    targetX.callback!(5)

    expect(instances).toHaveLength(2)
    expect(instances[1].applyState).toHaveBeenCalled()
  })
})
