import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import { ref } from 'vue'

import Load3DScene from '@/components/load3d/Load3DScene.vue'

const dragState = vi.hoisted(() => ({
  isDragging: null as Ref<boolean> | null,
  dragMessage: null as Ref<string> | null,
  handleDragOver: vi.fn(),
  handleDragLeave: vi.fn(),
  handleDrop: vi.fn(),
  capturedOptions: null as {
    onModelDrop?: (file: File) => Promise<void>
    disabled?: { value?: boolean } | boolean
  } | null
}))

vi.mock('@/composables/useLoad3dDrag', () => ({
  useLoad3dDrag: (options: unknown) => {
    dragState.capturedOptions = options as typeof dragState.capturedOptions
    return {
      isDragging: dragState.isDragging!,
      dragMessage: dragState.dragMessage!,
      handleDragOver: dragState.handleDragOver,
      handleDragLeave: dragState.handleDragLeave,
      handleDrop: dragState.handleDrop
    }
  }
}))

vi.mock('@/components/common/LoadingOverlay.vue', () => ({
  default: {
    name: 'LoadingOverlayStub',
    props: ['loading', 'loadingMessage'],
    template: `
      <div data-testid="loading-overlay">
        <span v-if="loading">{{ loadingMessage }}</span>
      </div>
    `
  }
}))

type RenderOpts = {
  loading?: boolean
  loadingMessage?: string
  isPreview?: boolean
  onModelDrop?: (file: File) => void | Promise<void>
  initializeLoad3d?: (container: HTMLElement) => Promise<void>
  cleanup?: () => void
}

function renderComponent(opts: RenderOpts = {}) {
  const initializeLoad3d =
    opts.initializeLoad3d ?? vi.fn().mockResolvedValue(undefined)
  const cleanup = opts.cleanup ?? vi.fn()

  const utils = render(Load3DScene, {
    props: {
      initializeLoad3d,
      cleanup,
      loading: opts.loading ?? false,
      loadingMessage: opts.loadingMessage ?? '',
      onModelDrop: opts.onModelDrop,
      isPreview: opts.isPreview ?? false
    }
  })

  return { ...utils, initializeLoad3d, cleanup }
}

describe('Load3DScene', () => {
  beforeEach(() => {
    dragState.isDragging = ref(false)
    dragState.dragMessage = ref('')
    dragState.handleDragOver.mockReset()
    dragState.handleDragLeave.mockReset()
    dragState.handleDrop.mockReset()
    dragState.capturedOptions = null
  })

  it('renders the loading overlay child', () => {
    renderComponent()
    expect(screen.getByTestId('loading-overlay')).toBeInTheDocument()
  })

  it('forwards loading + loadingMessage props to the overlay', () => {
    renderComponent({ loading: true, loadingMessage: 'Loading model…' })

    expect(screen.getByText('Loading model…')).toBeInTheDocument()
  })

  it('calls initializeLoad3d with the container element on mount', async () => {
    const initializeLoad3d = vi.fn().mockResolvedValue(undefined)
    renderComponent({ initializeLoad3d })

    expect(initializeLoad3d).toHaveBeenCalledOnce()
    expect(initializeLoad3d.mock.calls[0][0]).toBeInstanceOf(HTMLElement)
  })

  it('calls cleanup when unmounted', () => {
    const cleanup = vi.fn()
    const { unmount } = renderComponent({ cleanup })

    unmount()

    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('does not render the drag overlay when not dragging', () => {
    dragState.isDragging!.value = false
    dragState.dragMessage!.value = 'Drop'
    renderComponent()

    expect(screen.queryByText('Drop')).not.toBeInTheDocument()
  })

  it('renders the drag overlay with the drag message while dragging in non-preview mode', () => {
    dragState.isDragging!.value = true
    dragState.dragMessage!.value = 'Drop to load model'
    renderComponent({ isPreview: false })

    expect(screen.getByText('Drop to load model')).toBeInTheDocument()
  })

  it('hides the drag overlay even while dragging when in preview mode', () => {
    dragState.isDragging!.value = true
    dragState.dragMessage!.value = 'Drop to load model'
    renderComponent({ isPreview: true })

    expect(screen.queryByText('Drop to load model')).not.toBeInTheDocument()
  })

  it('forwards a dropped file through useLoad3dDrag to the onModelDrop prop', async () => {
    const onModelDrop = vi.fn()
    renderComponent({ onModelDrop })

    const file = new File(['m'], 'model.glb')
    await dragState.capturedOptions!.onModelDrop!(file)

    expect(onModelDrop).toHaveBeenCalledWith(file)
  })

  it('does not throw when a file is dropped without an onModelDrop handler', async () => {
    renderComponent({ onModelDrop: undefined })

    const file = new File(['m'], 'model.glb')
    await expect(
      dragState.capturedOptions!.onModelDrop!(file)
    ).resolves.toBeUndefined()
  })
})
