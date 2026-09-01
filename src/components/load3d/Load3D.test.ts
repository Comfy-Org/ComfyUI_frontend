import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import Load3D from '@/components/load3d/Load3D.vue'
import type { ComponentWidget } from '@/scripts/domWidget'

const { load3dState, resolveNodeMock, settingGetMock } = vi.hoisted(() => ({
  load3dState: {
    current: null as ReturnType<typeof buildLoad3dStub> | null
  },
  resolveNodeMock: vi.fn(),
  settingGetMock: vi.fn()
}))

function buildLoad3dStub() {
  return {
    sceneConfig: ref({}),
    modelConfig: ref({}),
    cameraConfig: ref({}),
    lightConfig: ref({}),
    isRecording: ref(false),
    isPreview: ref(false),
    canFitToViewer: ref(true),
    canUseGizmo: ref(true),
    canUseLighting: ref(true),
    canExport: ref(true),
    materialModes: ref(['original', 'normal', 'wireframe']),
    hasSkeleton: ref(false),
    hasRecording: ref(false),
    recordingDuration: ref(0),
    animations: ref<Array<{ name: string; index: number }>>([]),
    playing: ref(false),
    selectedSpeed: ref(1),
    selectedAnimation: ref(0),
    animationProgress: ref(0),
    animationDuration: ref(0),
    loading: ref(false),
    loadingMessage: ref(''),
    initializeLoad3d: vi.fn(),
    handleMouseEnter: vi.fn(),
    handleMouseLeave: vi.fn(),
    handleStartRecording: vi.fn(),
    handleStopRecording: vi.fn(),
    handleExportRecording: vi.fn(),
    handleClearRecording: vi.fn(),
    handleSeek: vi.fn(),
    handleBackgroundImageUpdate: vi.fn(),
    handleHDRIFileUpdate: vi.fn(),
    handleExportModel: vi.fn(),
    handleModelDrop: vi.fn(),
    handleToggleGizmo: vi.fn(),
    handleSetGizmoMode: vi.fn(),
    handleResetGizmoTransform: vi.fn(),
    handleFitToViewer: vi.fn(),
    cleanup: vi.fn()
  }
}

vi.mock('@/composables/useLoad3d', () => ({
  useLoad3d: () => load3dState.current
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ get: settingGetMock })
}))

vi.mock('@/utils/litegraphUtil', () => ({
  resolveNode: resolveNodeMock
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      load3d: { fitToViewer: 'Fit to viewer' }
    }
  }
})

type RenderOptions = {
  widget?: unknown
  nodeId?: number | string
  stateOverrides?: Partial<ReturnType<typeof buildLoad3dStub>>
  enable3DViewer?: boolean
}

const MOCK_NODE = { id: 'node', type: 'Load3D' }

function renderLoad3D(options: RenderOptions = {}) {
  const stub = buildLoad3dStub()
  if (options.stateOverrides) {
    Object.assign(stub, options.stateOverrides)
  }
  load3dState.current = stub

  settingGetMock.mockImplementation((key: string) =>
    key === 'Comfy.Load3D.3DViewerEnable'
      ? (options.enable3DViewer ?? false)
      : undefined
  )

  return {
    ...render(Load3D, {
      props: {
        widget: (options.widget ?? {
          node: MOCK_NODE
        }) as unknown as ComponentWidget<string[]>,
        nodeId: options.nodeId
      },
      global: {
        plugins: [i18n],
        stubs: {
          Load3DControls: {
            name: 'Load3DControls',
            template: '<div data-testid="load3d-controls" />'
          },
          Load3DScene: {
            name: 'Load3DScene',
            template: '<div data-testid="load3d-scene" />'
          },
          AnimationControls: {
            name: 'AnimationControls',
            template: '<div data-testid="animation-controls" />'
          },
          RecordingControls: {
            name: 'RecordingControls',
            template: '<div data-testid="recording-controls" />'
          },
          ViewerControls: {
            name: 'ViewerControls',
            template: '<div data-testid="viewer-controls" />'
          },
          Button: {
            name: 'Button',
            props: ['ariaLabel'],
            template:
              '<button type="button" :aria-label="ariaLabel"><slot /></button>'
          }
        },
        directives: {
          tooltip: () => {}
        }
      }
    }),
    stub
  }
}

describe('Load3D', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    load3dState.current = null
  })

  describe('node resolution', () => {
    it('uses widget.node when the widget is a ComponentWidget', () => {
      renderLoad3D({ widget: { node: MOCK_NODE } })

      expect(screen.getByTestId('load3d-scene')).toBeInTheDocument()
      expect(resolveNodeMock).not.toHaveBeenCalled()
    })

    it('falls back to resolveNode(nodeId) when the widget lacks a node', async () => {
      resolveNodeMock.mockReturnValue(MOCK_NODE)
      renderLoad3D({ widget: {}, nodeId: 42 })

      expect(resolveNodeMock).toHaveBeenCalledWith(42)
      expect(await screen.findByTestId('load3d-scene')).toBeInTheDocument()
    })

    it('does not render Load3DScene when no node can be resolved', async () => {
      resolveNodeMock.mockReturnValue(null)
      renderLoad3D({ widget: {}, nodeId: 99 })

      await Promise.resolve()
      expect(screen.queryByTestId('load3d-scene')).not.toBeInTheDocument()
    })
  })

  describe('capability-driven chrome', () => {
    it('shows the fit-to-viewer button when canFitToViewer is true', () => {
      renderLoad3D({ stateOverrides: { canFitToViewer: ref(true) } })
      expect(
        screen.getByRole('button', { name: 'Fit to viewer' })
      ).toBeInTheDocument()
    })

    it('hides the fit-to-viewer button when canFitToViewer is false', () => {
      renderLoad3D({ stateOverrides: { canFitToViewer: ref(false) } })
      expect(
        screen.queryByRole('button', { name: 'Fit to viewer' })
      ).not.toBeInTheDocument()
    })

    it('invokes handleFitToViewer when the fit button is clicked', async () => {
      const { stub } = renderLoad3D()
      const user = userEvent.setup()

      await user.click(screen.getByRole('button', { name: 'Fit to viewer' }))

      expect(stub.handleFitToViewer).toHaveBeenCalledOnce()
    })
  })

  describe('viewer controls', () => {
    it('renders ViewerControls when the 3D viewer setting is enabled', () => {
      renderLoad3D({ enable3DViewer: true })
      expect(screen.getByTestId('viewer-controls')).toBeInTheDocument()
    })

    it('hides ViewerControls when the 3D viewer setting is disabled', () => {
      renderLoad3D({ enable3DViewer: false })
      expect(screen.queryByTestId('viewer-controls')).not.toBeInTheDocument()
    })

    it('hides ViewerControls when there is no node even if the setting is on', () => {
      resolveNodeMock.mockReturnValue(null)
      renderLoad3D({ widget: {}, nodeId: 1, enable3DViewer: true })
      expect(screen.queryByTestId('viewer-controls')).not.toBeInTheDocument()
    })
  })

  describe('recording controls', () => {
    it('renders RecordingControls in regular (non-preview) mode', () => {
      renderLoad3D({ stateOverrides: { isPreview: ref(false) } })
      expect(screen.getByTestId('recording-controls')).toBeInTheDocument()
    })

    it('hides RecordingControls in preview mode', () => {
      renderLoad3D({ stateOverrides: { isPreview: ref(true) } })
      expect(screen.queryByTestId('recording-controls')).not.toBeInTheDocument()
    })
  })

  describe('animation controls', () => {
    it('renders AnimationControls when animations are present', () => {
      renderLoad3D({
        stateOverrides: {
          animations: ref([{ name: 'idle', index: 0 }])
        }
      })
      expect(screen.getByTestId('animation-controls')).toBeInTheDocument()
    })

    it('hides AnimationControls when the animation list is empty', () => {
      renderLoad3D()
      expect(screen.queryByTestId('animation-controls')).not.toBeInTheDocument()
    })
  })
})
