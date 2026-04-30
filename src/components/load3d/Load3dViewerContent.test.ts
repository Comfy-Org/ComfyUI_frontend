import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import Load3dViewerContent from '@/components/load3d/Load3dViewerContent.vue'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

class NoopMutationObserver {
  observe() {}
  disconnect() {}
  takeRecords(): MutationRecord[] {
    return []
  }
}

const {
  viewerState,
  dragState,
  capturedDragOptions,
  dialogCloseMock,
  serviceSourceLoad3d,
  getLoad3dAsyncMock
} = vi.hoisted(() => ({
  viewerState: {
    current: null as ReturnType<typeof buildViewerStub> | null
  },
  dragState: {
    current: null as ReturnType<typeof buildDragStub> | null
  },
  capturedDragOptions: {
    current: null as { onModelDrop?: (file: File) => Promise<void> } | null
  },
  dialogCloseMock: vi.fn(),
  serviceSourceLoad3d: {
    current: null as unknown
  },
  getLoad3dAsyncMock: vi.fn()
}))

function buildViewerStub() {
  return {
    backgroundColor: ref('#282828'),
    showGrid: ref(true),
    cameraType: ref('perspective'),
    fov: ref(75),
    lightIntensity: ref(1),
    backgroundImage: ref(''),
    hasBackgroundImage: ref(false),
    backgroundRenderMode: ref('tiled'),
    upDirection: ref('original'),
    materialMode: ref('original'),
    gizmoEnabled: ref(false),
    gizmoMode: ref('translate'),
    isPreview: ref(false),
    isStandaloneMode: ref(false),
    canUseGizmo: ref(true),
    canUseLighting: ref(true),
    canExport: ref(true),
    materialModes: ref(['original', 'normal', 'wireframe']),
    animations: ref<Array<{ name: string; index: number }>>([]),
    playing: ref(false),
    selectedSpeed: ref(1),
    selectedAnimation: ref(0),
    animationProgress: ref(0),
    animationDuration: ref(0),
    initializeViewer: vi.fn().mockResolvedValue(undefined),
    initializeStandaloneViewer: vi.fn().mockResolvedValue(undefined),
    exportModel: vi.fn(),
    handleResize: vi.fn(),
    handleMouseEnter: vi.fn(),
    handleMouseLeave: vi.fn(),
    restoreInitialState: vi.fn(),
    refreshViewport: vi.fn(),
    handleBackgroundImageUpdate: vi.fn(),
    handleModelDrop: vi.fn().mockResolvedValue(undefined),
    handleSeek: vi.fn(),
    resetGizmoTransform: vi.fn()
  }
}

function buildDragStub() {
  return {
    isDragging: ref(false),
    dragMessage: ref(''),
    handleDragOver: vi.fn(),
    handleDragLeave: vi.fn(),
    handleDrop: vi.fn()
  }
}

vi.mock('@/composables/useLoad3dViewer', () => ({
  useLoad3dViewer: () => viewerState.current
}))

vi.mock('@/composables/useLoad3dDrag', () => ({
  useLoad3dDrag: (opts: { onModelDrop?: (file: File) => Promise<void> }) => {
    capturedDragOptions.current = opts
    return dragState.current
  }
}))

vi.mock('@/services/load3dService', () => ({
  useLoad3dService: () => ({
    getOrCreateViewerSync: () => viewerState.current,
    getLoad3dAsync: getLoad3dAsyncMock
  })
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ closeDialog: dialogCloseMock })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { cancel: 'Cancel' }
    }
  }
})

type RenderOptions = {
  node?: LGraphNode
  modelUrl?: string
  viewerOverrides?: Partial<ReturnType<typeof buildViewerStub>>
  dragOverrides?: Partial<ReturnType<typeof buildDragStub>>
}

const MOCK_NODE = createMockLGraphNode({ id: 'node-1', type: 'Load3D' })

async function renderViewerContent(options: RenderOptions = {}) {
  const viewerStub = buildViewerStub()
  if (options.viewerOverrides) {
    Object.assign(viewerStub, options.viewerOverrides)
  }
  viewerState.current = viewerStub

  const dragStub = buildDragStub()
  if (options.dragOverrides) {
    Object.assign(dragStub, options.dragOverrides)
  }
  dragState.current = dragStub

  getLoad3dAsyncMock.mockResolvedValue(serviceSourceLoad3d.current)

  const result = render(Load3dViewerContent, {
    props: {
      node: options.node,
      modelUrl: options.modelUrl
    },
    global: {
      plugins: [i18n],
      stubs: {
        AnimationControls: {
          name: 'AnimationControls',
          template: '<div data-testid="animation-controls" />'
        },
        CameraControls: {
          name: 'CameraControls',
          template: '<div data-testid="camera-controls" />'
        },
        ExportControls: {
          name: 'ExportControls',
          template: '<div data-testid="export-controls" />'
        },
        GizmoControls: {
          name: 'GizmoControls',
          template: '<div data-testid="gizmo-controls" />'
        },
        LightControls: {
          name: 'LightControls',
          template: '<div data-testid="light-controls" />'
        },
        ModelControls: {
          name: 'ModelControls',
          template: '<div data-testid="model-controls" />'
        },
        SceneControls: {
          name: 'SceneControls',
          template: '<div data-testid="scene-controls" />'
        },
        Button: {
          name: 'Button',
          template: '<button type="button"><slot /></button>'
        }
      }
    }
  })
  return {
    ...result,
    viewer: viewerStub,
    drag: dragStub,
    user: userEvent.setup()
  }
}

describe('Load3dViewerContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('MutationObserver', NoopMutationObserver)
    viewerState.current = null
    dragState.current = null
    capturedDragOptions.current = null
    serviceSourceLoad3d.current = null
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('initialization', () => {
    it('invokes initializeStandaloneViewer when a modelUrl is provided without a node', async () => {
      const { viewer } = await renderViewerContent({
        modelUrl: 'api/view?filename=cube.glb'
      })

      await vi.waitFor(() =>
        expect(viewer.initializeStandaloneViewer).toHaveBeenCalledWith(
          expect.any(HTMLElement),
          'api/view?filename=cube.glb'
        )
      )
      expect(viewer.initializeViewer).not.toHaveBeenCalled()
    })

    it('invokes initializeViewer with the source load3d when a node is provided', async () => {
      const source = { id: 'source-load3d' }
      serviceSourceLoad3d.current = source
      const { viewer } = await renderViewerContent({ node: MOCK_NODE })

      await vi.waitFor(() =>
        expect(viewer.initializeViewer).toHaveBeenCalledWith(
          expect.any(HTMLElement),
          source
        )
      )
      expect(getLoad3dAsyncMock).toHaveBeenCalledWith(MOCK_NODE)
      expect(viewer.initializeStandaloneViewer).not.toHaveBeenCalled()
    })

    it('skips initializeViewer if the source load3d cannot be resolved', async () => {
      serviceSourceLoad3d.current = null
      const { viewer } = await renderViewerContent({ node: MOCK_NODE })

      await vi.waitFor(() =>
        expect(getLoad3dAsyncMock).toHaveBeenCalledWith(MOCK_NODE)
      )
      expect(viewer.initializeViewer).not.toHaveBeenCalled()
    })
  })

  describe('capability gating', () => {
    it('hides LightControls when canUseLighting is false', async () => {
      await renderViewerContent({
        node: MOCK_NODE,
        viewerOverrides: { canUseLighting: ref(false) }
      })

      expect(screen.queryByTestId('light-controls')).not.toBeInTheDocument()
    })

    it('hides GizmoControls when canUseGizmo is false', async () => {
      await renderViewerContent({
        node: MOCK_NODE,
        viewerOverrides: { canUseGizmo: ref(false) }
      })

      expect(screen.queryByTestId('gizmo-controls')).not.toBeInTheDocument()
    })

    it('hides ExportControls when canExport is false', async () => {
      await renderViewerContent({
        node: MOCK_NODE,
        viewerOverrides: { canExport: ref(false) }
      })

      expect(screen.queryByTestId('export-controls')).not.toBeInTheDocument()
    })

    it('renders all capability-gated controls when all flags are true', async () => {
      await renderViewerContent({ node: MOCK_NODE })

      expect(screen.getByTestId('light-controls')).toBeInTheDocument()
      expect(screen.getByTestId('gizmo-controls')).toBeInTheDocument()
      expect(screen.getByTestId('export-controls')).toBeInTheDocument()
    })
  })

  describe('animation controls', () => {
    it('hides AnimationControls when the animation list is empty', async () => {
      await renderViewerContent({ node: MOCK_NODE })
      expect(screen.queryByTestId('animation-controls')).not.toBeInTheDocument()
    })

    it('shows AnimationControls when animations are present', async () => {
      await renderViewerContent({
        node: MOCK_NODE,
        viewerOverrides: {
          animations: ref([{ name: 'idle', index: 0 }])
        }
      })
      expect(screen.getByTestId('animation-controls')).toBeInTheDocument()
    })
  })

  describe('drag overlay', () => {
    it('is hidden by default', async () => {
      await renderViewerContent({ node: MOCK_NODE })
      expect(screen.queryByText(/drag/i)).not.toBeInTheDocument()
    })

    it('renders the drag message when useLoad3dDrag reports dragging', async () => {
      await renderViewerContent({
        node: MOCK_NODE,
        dragOverrides: {
          isDragging: ref(true),
          dragMessage: ref('Drop to load')
        }
      })

      expect(screen.getByText('Drop to load')).toBeInTheDocument()
    })
  })

  describe('drag integration', () => {
    it('routes a dropped file through useLoad3dDrag back to viewer.handleModelDrop', async () => {
      const { viewer } = await renderViewerContent({ node: MOCK_NODE })
      const file = new File(['cube'], 'cube.glb')

      await capturedDragOptions.current!.onModelDrop!(file)

      expect(viewer.handleModelDrop).toHaveBeenCalledWith(file)
    })
  })

  describe('cancel button', () => {
    it('closes the dialog in node mode and restores initial viewer state', async () => {
      const { user, viewer } = await renderViewerContent({ node: MOCK_NODE })

      await user.click(screen.getByRole('button', { name: /Cancel/ }))

      expect(viewer.restoreInitialState).toHaveBeenCalledOnce()
      expect(dialogCloseMock).toHaveBeenCalledOnce()
    })

    it('closes the dialog in standalone mode without touching initial state', async () => {
      const { user, viewer } = await renderViewerContent({
        modelUrl: 'api/view?filename=cube.glb'
      })

      await user.click(screen.getByRole('button', { name: /Cancel/ }))

      expect(viewer.restoreInitialState).not.toHaveBeenCalled()
      expect(dialogCloseMock).toHaveBeenCalledOnce()
    })
  })
})
