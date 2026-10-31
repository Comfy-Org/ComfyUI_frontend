import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import type { RenderOptions } from '@testing-library/vue'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, onBeforeUnmount, reactive } from 'vue'
import type { PropType } from 'vue'
import { createI18n } from 'vue-i18n'

import { useSettingStore } from '@/platform/settings/settingStore'
import type { SidebarTabExtension } from '@/types/extensionTypes'
import { useBootstrapStore } from '@/stores/bootstrapStore'

import GraphCanvas from './GraphCanvas.vue'

const mocks = vi.hoisted(() => ({
  handleStartupOutcome: vi.fn(),
  handleUrlWorkflow: vi.fn(),
  initializeWorkflow: vi.fn(),
  loadTemplateFromUrlIfPresent: vi.fn(),
  loadSharedWorkflowFromUrlIfPresent: vi.fn(),
  firstTabDestroy: vi.fn(),
  secondTabDestroy: vi.fn(),
  workspaceStore: {
    spinner: false,
    focusMode: false,
    sidebarTab: {
      activeSidebarTab: null as SidebarTabExtension | null
    }
  }
}))

vi.mock(
  '@/renderer/extensions/firstRunTour/gettingStarted/firstRunEntry',
  () => ({
    useFirstRunEntry: () => ({
      gettingStartedVisible: { value: false },
      handleStartupOutcome: mocks.handleStartupOutcome,
      handleUrlWorkflow: mocks.handleUrlWorkflow,
      dismissGettingStarted: vi.fn()
    })
  })
)

vi.mock(
  '@/platform/workflow/persistence/composables/useWorkflowPersistenceV2',
  () => ({
    useWorkflowPersistenceV2: () => ({
      initializeWorkflow: mocks.initializeWorkflow,
      restoreWorkflowTabsState: vi.fn(),
      loadTemplateFromUrlIfPresent: mocks.loadTemplateFromUrlIfPresent,
      loadSharedWorkflowFromUrlIfPresent:
        mocks.loadSharedWorkflowFromUrlIfPresent
    })
  })
)

vi.mock('@/scripts/app', () => {
  const canvas = {
    render_canvas_border: false,
    graph: null,
    onSelectionChange: null,
    setDirty: vi.fn(),
    canvas: document.createElement('canvas')
  }
  return {
    app: {
      vueAppReady: false,
      canvas,
      graph: null,
      rootGraph: null,
      ui: { settings: { dispatchChange: vi.fn() } },
      setup: vi.fn()
    }
  }
})

vi.mock('@/scripts/changeTracker', () => ({
  ChangeTracker: { init: vi.fn() }
}))

vi.mock('@/services/useNewUserService', () => ({
  useNewUserService: () => ({
    initializeIfNewUser: vi.fn(),
    isNewUser: () => false
  })
}))

vi.mock('@/composables/useUrlActionLoaders', () => ({
  useUrlActionLoaders: () => ({ runUrlActionLoaders: vi.fn() })
}))

vi.mock('@/platform/updates/common/releaseStore', () => ({
  useReleaseStore: () => ({ initialize: vi.fn() })
}))

vi.mock('@/composables/graph/useVueNodeLifecycle', () => ({
  useVueNodeLifecycle: () => ({
    nodeManager: { value: null },
    setupEmptyGraphListener: vi.fn(),
    initializeNodeManager: vi.fn(),
    disposeNodeManagerAndSyncs: vi.fn(),
    cleanup: vi.fn()
  })
}))

vi.mock('@/composables/graph/useErrorClearingHooks', () => ({
  installErrorClearingHooks: vi.fn()
}))

vi.mock('@/services/colorPaletteService', () => ({
  useColorPaletteService: () => ({ loadColorPalette: vi.fn() })
}))

vi.mock('@/renderer/core/canvas/useCanvasInteractions', () => ({
  useCanvasInteractions: () => ({ forwardEventToCanvas: vi.fn() })
}))

vi.mock('@/composables/useCanvasDrop', () => ({
  useCanvasDrop: vi.fn()
}))
vi.mock('@/platform/settings/composables/useLitegraphSettings', () => ({
  useLitegraphSettings: vi.fn()
}))
vi.mock('@/composables/node/useNodeBadge', () => ({ useNodeBadge: vi.fn() }))
vi.mock('@/composables/useGlobalLitegraph', () => ({
  useGlobalLitegraph: vi.fn()
}))
vi.mock('@/composables/useContextMenuTranslation', () => ({
  useContextMenuTranslation: vi.fn()
}))
vi.mock('@/composables/graph/useGroupContextMenu', () => ({
  useGroupContextMenu: vi.fn()
}))
// Instantiating the real store pulls in Firebase-backed workflow state.
vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: () => mocks.workspaceStore
}))

vi.mock('@/composables/useCopy', () => ({ useCopy: vi.fn() }))
vi.mock('@/composables/usePaste', () => ({ usePaste: vi.fn() }))
vi.mock(
  '@/platform/workflow/persistence/composables/useWorkflowAutoSave',
  () => ({ useWorkflowAutoSave: vi.fn() })
)

const firstTab: SidebarTabExtension = {
  id: 'first-custom-sidebar-tab',
  title: 'First',
  type: 'custom',
  render: vi.fn(),
  destroy: mocks.firstTabDestroy
}

const secondTab: SidebarTabExtension = {
  id: 'second-custom-sidebar-tab',
  title: 'Second',
  type: 'custom',
  render: vi.fn(),
  destroy: mocks.secondTabDestroy
}

const builtInTab: SidebarTabExtension = {
  id: 'built-in-sidebar-tab',
  title: 'Built-in',
  type: 'vue',
  component: defineComponent({ template: '<div>Built-in</div>' })
}

const sidebarTabState = reactive({
  activeSidebarTab: null as SidebarTabExtension | null
})
mocks.workspaceStore.sidebarTab = sidebarTabState

// GraphCanvas owns replacement policy; ExtensionSlot owns the destroy callback.
// Capturing the mounted extension keeps this stub focused on that seam.
const ExtensionSlotStub = defineComponent({
  props: {
    extension: {
      type: Object as PropType<SidebarTabExtension>,
      required: true
    }
  },
  setup(props) {
    const mountedExtension = props.extension
    onBeforeUnmount(() => {
      if (mountedExtension.type === 'custom') mountedExtension.destroy?.()
    })
  },
  template: '<div data-testid="sidebar-extension">{{ extension.id }}</div>'
})

async function mountGraphCanvas() {
  const pinia = createTestingPinia({ stubActions: false })
  setActivePinia(pinia)

  useSettingStore().isReady = true
  useBootstrapStore().isI18nReady = true

  render(GraphCanvas, {
    shallow: true,
    global: {
      plugins: [
        pinia,
        createI18n({ legacy: false, locale: 'en', missingWarn: false })
      ],
      stubs: {
        ExtensionSlot: ExtensionSlotStub,
        LiteGraphCanvasSplitterOverlay: {
          template: '<div><slot name="side-bar-panel" /></div>'
        }
      }
    }
  } as RenderOptions<typeof GraphCanvas>)

  for (let i = 0; i < 50; i++) {
    await nextTick()
    await Promise.resolve()
  }
}

describe('GraphCanvas sidebar extension lifecycle', () => {
  beforeEach(() => {
    Object.assign(mocks.workspaceStore, {
      spinner: false,
      focusMode: false
    })
    sidebarTabState.activeSidebarTab = firstTab
    mocks.initializeWorkflow.mockResolvedValue('url-intent')
    mocks.loadTemplateFromUrlIfPresent.mockResolvedValue('image_to_image')
    mocks.loadSharedWorkflowFromUrlIfPresent.mockResolvedValue(undefined)
    mocks.firstTabDestroy.mockClear()
    mocks.secondTabDestroy.mockClear()
  })

  it('destroys the previous custom extension when the active tab changes', async () => {
    await mountGraphCanvas()

    expect(screen.getByTestId('sidebar-extension')).toHaveTextContent(
      firstTab.id
    )

    sidebarTabState.activeSidebarTab = secondTab
    await nextTick()

    expect(screen.getByTestId('sidebar-extension')).toHaveTextContent(
      secondTab.id
    )
    expect(mocks.firstTabDestroy).toHaveBeenCalledTimes(1)
    expect(mocks.secondTabDestroy).not.toHaveBeenCalled()

    sidebarTabState.activeSidebarTab = builtInTab
    await nextTick()

    expect(screen.getByTestId('sidebar-extension')).toHaveTextContent(
      builtInTab.id
    )
    expect(mocks.secondTabDestroy).toHaveBeenCalledTimes(1)
  })
})
