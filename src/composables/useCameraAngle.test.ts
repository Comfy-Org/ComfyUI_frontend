import { ref } from 'vue'
import type { Ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'

interface ViewportInstance {
  ctorArgs: unknown[]
  applyState: ReturnType<typeof vi.fn>
  setViewMode: ReturnType<typeof vi.fn>
  setPreviewVisible: ReturnType<typeof vi.fn>
  setImage: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
  viewport: {
    updateStatusMouseOnScene: ReturnType<typeof vi.fn>
    updateStatusMouseOnNode: ReturnType<typeof vi.fn>
    refreshViewport: ReturnType<typeof vi.fn>
  }
}

const { ViewportMock, instances } = vi.hoisted(() => {
  const instances: ViewportInstance[] = []
  const ViewportMock = vi.fn(function (...ctorArgs: unknown[]) {
    const instance: ViewportInstance = {
      ctorArgs,
      applyState: vi.fn(),
      setViewMode: vi.fn(),
      setPreviewVisible: vi.fn(),
      setImage: vi.fn(() => Promise.resolve()),
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
  return { ViewportMock, instances }
})

vi.mock<unknown>(
  import('@/extensions/core/cameraAngle/CameraAngleViewport'),
  () => ({
    CameraAngleViewport: ViewportMock
  })
)

import { useCameraAngle } from './useCameraAngle'

interface FakeWidget {
  name: string
  value: unknown
  callback?: (value: unknown, ...rest: unknown[]) => void
}

interface FakeNode {
  widgets: FakeWidget[]
  imageSource: FakeNode | null
  findInputSlot(name: string): number
  getInputNode(slot: number): FakeNode | null
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  onConnectionsChange?: () => void
}

function makeNode(values: Record<string, unknown>): FakeNode {
  return {
    widgets: Object.entries(values).map(([name, value]) => ({ name, value })),
    imageSource: null,
    findInputSlot(name) {
      return name === 'image' ? 0 : -1
    },
    getInputNode() {
      return this.imageSource
    }
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

function ctorState(instance: ViewportInstance) {
  return instance.ctorArgs[1] as {
    horizontal: number
    vertical: number
    zoom: number
  }
}

function ctorOptions(instance: ViewportInstance) {
  return instance.ctorArgs[2] as {
    onStateChange: (state: {
      horizontal: number
      vertical: number
      zoom: number
    }) => void
  }
}

const DEFAULT_WIDGETS = {
  horizontal_angle: 30,
  vertical_angle: 10,
  zoom: 2,
  view: 'object'
}

beforeEach(() => {
  instances.length = 0
  ViewportMock.mockClear()
})

describe('useCameraAngle', () => {
  it('constructs the viewport from widget values and restores the stored view mode', () => {
    const node = makeNode(DEFAULT_WIDGETS)
    const container = document.createElement('div')
    const camera = useCameraAngle(nodeRef(node))

    camera.initialize(container)

    expect(ViewportMock).toHaveBeenCalledOnce()
    expect(instances[0].ctorArgs[0]).toBe(container)
    expect(ctorState(instances[0])).toEqual({
      horizontal: 30,
      vertical: 10,
      zoom: 2
    })
    expect(instances[0].setViewMode).toHaveBeenCalledWith('object')
    expect(instances[0].setPreviewVisible).toHaveBeenCalledWith(false)
    expect(camera.viewMode.value).toBe('object')
    expect(camera.prompt.value).toBe(
      'front-right quarter view eye-level shot medium shot'
    )
  })

  it('does nothing when the node is null', () => {
    const camera = useCameraAngle(ref(null))
    camera.initialize(document.createElement('div'))

    expect(ViewportMock).not.toHaveBeenCalled()
  })

  it('alerts and does not throw when the viewport fails to construct', () => {
    ViewportMock.mockImplementationOnce(() => {
      throw new Error('webgl unavailable')
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const camera = useCameraAngle(nodeRef(makeNode(DEFAULT_WIDGETS)))

    expect(() => camera.initialize(document.createElement('div'))).not.toThrow()
    expect(useToastStore().addAlert).toHaveBeenCalledOnce()

    consoleError.mockRestore()
  })

  it('writes viewport interaction results back into the widgets', () => {
    const node = makeNode(DEFAULT_WIDGETS)
    const camera = useCameraAngle(nodeRef(node))
    camera.initialize(document.createElement('div'))

    ctorOptions(instances[0]).onStateChange({
      horizontal: 180,
      vertical: 50,
      zoom: 9
    })

    expect(widget(node, 'horizontal_angle').value).toBe(180)
    expect(widget(node, 'vertical_angle').value).toBe(50)
    expect(widget(node, 'zoom').value).toBe(9)
    expect(camera.prompt.value).toBe('back view high-angle shot close-up')
  })

  it('re-applies state to the viewport when a widget changes, keeping the original callback', () => {
    const node = makeNode(DEFAULT_WIDGETS)
    const original = vi.fn()
    widget(node, 'zoom').callback = original
    const camera = useCameraAngle(nodeRef(node))
    camera.initialize(document.createElement('div'))

    const zoom = widget(node, 'zoom')
    zoom.value = 8
    zoom.callback!(8)

    expect(original).toHaveBeenCalledWith(8)
    expect(instances[0].applyState).toHaveBeenLastCalledWith({
      horizontal: 30,
      vertical: 10,
      zoom: 8
    })
    expect(camera.state.value.zoom).toBe(8)
  })

  it('applies a preset field with clamping and mirrors it to the widgets', () => {
    const node = makeNode(DEFAULT_WIDGETS)
    const camera = useCameraAngle(nodeRef(node))
    camera.initialize(document.createElement('div'))

    camera.setField('vertical', 99)

    expect(widget(node, 'vertical_angle').value).toBe(60)
    expect(instances[0].applyState).toHaveBeenLastCalledWith({
      horizontal: 30,
      vertical: 60,
      zoom: 2
    })
  })

  it('toggles the shot preview inset', () => {
    const camera = useCameraAngle(nodeRef(makeNode(DEFAULT_WIDGETS)))
    camera.initialize(document.createElement('div'))

    camera.setPreviewVisible(true)

    expect(camera.previewVisible.value).toBe(true)
    expect(instances[0].setPreviewVisible).toHaveBeenLastCalledWith(true)
  })

  it('persists the view mode into the view widget and forwards it', () => {
    const node = makeNode(DEFAULT_WIDGETS)
    const camera = useCameraAngle(nodeRef(node))
    camera.initialize(document.createElement('div'))

    camera.setViewMode('camera')

    expect(widget(node, 'view').value).toBe('camera')
    expect(instances[0].setViewMode).toHaveBeenLastCalledWith('camera')
  })

  it('shows the upstream image and clears it when the link is removed', () => {
    const node = makeNode(DEFAULT_WIDGETS)
    const source = makeNode({})
    node.imageSource = source
    const getNodeImageUrls = vi
      .spyOn(useNodeOutputStore(), 'getNodeImageUrls')
      .mockReturnValue(['http://example/upstream.png'])
    const camera = useCameraAngle(nodeRef(node))
    camera.initialize(document.createElement('div'))

    expect(getNodeImageUrls).toHaveBeenCalledWith(source)
    expect(instances[0].setImage).toHaveBeenCalledWith(
      'http://example/upstream.png'
    )

    node.imageSource = null
    node.onConnectionsChange?.()

    expect(instances[0].setImage).toHaveBeenLastCalledWith(null)
  })

  it('routes node hover into the viewport status flags', () => {
    const node = makeNode(DEFAULT_WIDGETS)
    const camera = useCameraAngle(nodeRef(node))
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

  it('removes the viewport and restores callbacks on cleanup', () => {
    const node = makeNode(DEFAULT_WIDGETS)
    const original = vi.fn()
    const originalEnter = vi.fn()
    const originalConnections = vi.fn()
    widget(node, 'zoom').callback = original
    node.onMouseEnter = originalEnter
    node.onConnectionsChange = originalConnections
    const camera = useCameraAngle(nodeRef(node))
    camera.initialize(document.createElement('div'))
    expect(node.onMouseEnter).not.toBe(originalEnter)

    camera.cleanup()

    expect(instances[0].remove).toHaveBeenCalledOnce()
    expect(widget(node, 'zoom').callback).toBe(original)
    expect(node.onMouseEnter).toBe(originalEnter)
    expect(node.onConnectionsChange).toBe(originalConnections)
  })
})
