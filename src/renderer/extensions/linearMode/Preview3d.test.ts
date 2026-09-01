import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { render, screen } from '@testing-library/vue'

const initializeStandaloneViewer = vi.fn()
const cleanup = vi.fn()

const viewerOverrides: Record<string, unknown> = {}

vi.mock('@/composables/useLoad3dViewer', () => ({
  useLoad3dViewer: () => ({
    initializeStandaloneViewer,
    cleanup,
    handleMouseEnter: vi.fn(),
    handleMouseLeave: vi.fn(),
    handleResize: vi.fn(),
    handleBackgroundImageUpdate: vi.fn(),
    exportModel: vi.fn(),
    handleSeek: vi.fn(),
    canUseGizmo: true,
    canUseLighting: true,
    canExport: true,
    materialModes: ['original', 'normal', 'wireframe'],
    hasSkeleton: false,
    animations: [],
    playing: false,
    selectedSpeed: 1,
    selectedAnimation: 0,
    animationProgress: 0,
    animationDuration: 0,
    ...viewerOverrides
  })
}))

vi.mock('@/components/load3d/Load3DControls.vue', () => ({
  default: {
    name: 'Load3DControlsStub',
    props: [
      'sceneConfig',
      'modelConfig',
      'cameraConfig',
      'lightConfig',
      'canUseGizmo',
      'canUseLighting',
      'canExport',
      'materialModes',
      'hasSkeleton'
    ],
    template: `
      <div data-testid="load3d-controls"
           :data-can-use-gizmo="canUseGizmo"
           :data-can-use-lighting="canUseLighting"
           :data-can-export="canExport"
           :data-has-skeleton="hasSkeleton"
           :data-material-modes="JSON.stringify(materialModes)"
      />
    `
  }
}))

vi.mock('@/components/load3d/controls/AnimationControls.vue', () => ({
  default: { template: '<div />' }
}))

describe('Preview3d', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const k of Object.keys(viewerOverrides)) delete viewerOverrides[k]
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function renderPreview3d(
    modelUrl = 'http://localhost/view?filename=model.glb'
  ) {
    const result = render(
      (await import('@/renderer/extensions/linearMode/Preview3d.vue')).default,
      { props: { modelUrl } }
    )
    await nextTick()
    await nextTick()
    return result
  }

  it('initializes the viewer on mount', async () => {
    const { unmount } = await renderPreview3d()

    expect(initializeStandaloneViewer).toHaveBeenCalledOnce()
    expect(initializeStandaloneViewer).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      'http://localhost/view?filename=model.glb'
    )

    unmount()
  })

  it('cleans up the viewer on unmount', async () => {
    const { unmount } = await renderPreview3d()
    cleanup.mockClear()

    unmount()

    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('reinitializes correctly after unmount and remount', async () => {
    const url = 'http://localhost/view?filename=model.glb'

    const result1 = await renderPreview3d(url)
    expect(initializeStandaloneViewer).toHaveBeenCalledTimes(1)

    cleanup.mockClear()
    result1.unmount()
    expect(cleanup).toHaveBeenCalledOnce()

    vi.clearAllMocks()

    const result2 = await renderPreview3d(url)
    expect(initializeStandaloneViewer).toHaveBeenCalledTimes(1)
    expect(initializeStandaloneViewer).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      url
    )

    cleanup.mockClear()
    result2.unmount()
    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('forwards the viewer capability flags to Load3DControls', async () => {
    Object.assign(viewerOverrides, {
      canUseGizmo: false,
      canUseLighting: false,
      canExport: false,
      materialModes: [],
      hasSkeleton: true
    })

    const { unmount } = await renderPreview3d()

    const controls = await screen.findByTestId('load3d-controls')
    expect(controls.getAttribute('data-can-use-gizmo')).toBe('false')
    expect(controls.getAttribute('data-can-use-lighting')).toBe('false')
    expect(controls.getAttribute('data-can-export')).toBe('false')
    expect(controls.getAttribute('data-has-skeleton')).toBe('true')
    expect(controls.getAttribute('data-material-modes')).toBe('[]')

    unmount()
  })

  it('reinitializes when modelUrl changes on existing instance', async () => {
    const result = await renderPreview3d(
      'http://localhost/view?filename=model-a.glb'
    )
    expect(initializeStandaloneViewer).toHaveBeenCalledOnce()

    vi.clearAllMocks()

    await result.rerender({
      modelUrl: 'http://localhost/view?filename=model-b.glb'
    })
    await nextTick()
    await nextTick()

    expect(cleanup).toHaveBeenCalledOnce()
    expect(initializeStandaloneViewer).toHaveBeenCalledOnce()
    expect(initializeStandaloneViewer).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      'http://localhost/view?filename=model-b.glb'
    )

    result.unmount()
  })
})
