import { fromAny } from '@total-typescript/shoehorn'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import Load3D from '@/components/load3d/Load3D.vue'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { ComponentWidget } from '@/scripts/domWidget'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'
import { resolveNode } from '@/utils/litegraphUtil'

const { load3dState } = vi.hoisted(() => ({
  load3dState: {
    current: null as ReturnType<typeof buildLoad3dStub> | null
  }
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

vi.mock<unknown>(import('@/composables/useLoad3d'), () => ({
  useLoad3d: () => load3dState.current
}))

vi.mock(import('@/utils/litegraphUtil'))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { play: 'Play' },
      load3d: { fitToViewer: 'Fit to viewer' }
    }
  }
})

type RenderOptions = {
  widget?: unknown
  nodeId?: NodeId
  stateOverrides?: Partial<ReturnType<typeof buildLoad3dStub>>
  enable3DViewer?: boolean
}

function createMockNode() {
  const node = new LGraphNode('Load3D')
  node.id = toNodeId('node')
  node.type = 'Load3D'
  return node
}

function renderLoad3D(options: RenderOptions = {}) {
  const stub = buildLoad3dStub()
  if (options.stateOverrides) {
    Object.assign(stub, options.stateOverrides)
  }
  load3dState.current = stub

  useSettingStore().settingValues['Comfy.Load3D.3DViewerEnable'] =
    options.enable3DViewer ?? false

  return {
    ...render(Load3D, {
      props: {
        widget: fromAny<ComponentWidget<string[]>, unknown>(
          options.widget ?? {
            node: createMockNode()
          }
        ),
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
          RecordMenuControl: {
            name: 'RecordMenuControl',
            template: '<div data-testid="record-menu-control" />'
          },
          ViewerControls: {
            name: 'ViewerControls',
            template: '<div data-testid="viewer-controls" />'
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
    load3dState.current = null
  })

  describe('node resolution', () => {
    it('uses widget.node when the widget is a ComponentWidget', () => {
      renderLoad3D({ widget: { node: createMockNode() } })

      expect(screen.getByTestId('load3d-scene')).toBeInTheDocument()
      expect(resolveNode).not.toHaveBeenCalled()
    })

    it('falls back to resolveNode(nodeId) when the widget lacks a node', async () => {
      const nodeId = toNodeId(42)
      vi.mocked(resolveNode).mockReturnValue(createMockNode())
      renderLoad3D({ widget: {}, nodeId })

      expect(resolveNode).toHaveBeenCalledWith(nodeId)
      expect(await screen.findByTestId('load3d-scene')).toBeInTheDocument()
    })

    it('does not render Load3DScene when no node can be resolved', async () => {
      vi.mocked(resolveNode).mockReturnValue(undefined)
      renderLoad3D({ widget: {}, nodeId: toNodeId(99) })

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
      vi.mocked(resolveNode).mockReturnValue(undefined)
      renderLoad3D({
        widget: {},
        nodeId: toNodeId(1),
        enable3DViewer: true
      })
      expect(screen.queryByTestId('viewer-controls')).not.toBeInTheDocument()
    })
  })

  describe('recording controls', () => {
    it('renders the record control in regular (non-preview) mode', () => {
      renderLoad3D({ stateOverrides: { isPreview: ref(false) } })
      expect(screen.getByTestId('record-menu-control')).toBeInTheDocument()
    })

    it('hides the record control in preview mode', () => {
      renderLoad3D({ stateOverrides: { isPreview: ref(true) } })
      expect(
        screen.queryByTestId('record-menu-control')
      ).not.toBeInTheDocument()
    })
  })

  describe('animation controls', () => {
    it('renders the animation strip when animations are present', () => {
      renderLoad3D({
        stateOverrides: {
          animations: ref([{ name: 'idle', index: 0 }])
        }
      })
      expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
    })

    it('hides the animation strip when the animation list is empty', () => {
      renderLoad3D()
      expect(
        screen.queryByTestId('animation-menu-strip')
      ).not.toBeInTheDocument()
    })
  })
})
