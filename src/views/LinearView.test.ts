import type * as VueUseCore from '@vueuse/core'
import { render, screen } from '@testing-library/vue'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SidebarTabExtension } from '@/types/extensionTypes'

import LinearView from './LinearView.vue'

interface ViewState {
  mobileDisplay: boolean
  sidebarLocation: 'left' | 'right'
  isBuilderMode: boolean
  isArrangeMode: boolean
  activeTab: SidebarTabExtension | null
  hasOutputs: boolean
}

const state = vi.hoisted<ViewState>(() => ({
  mobileDisplay: false,
  sidebarLocation: 'left',
  isBuilderMode: false,
  isArrangeMode: false,
  activeTab: null,
  hasOutputs: false
}))

const onResizeEnd = vi.hoisted(() => vi.fn())

vi.mock('@vueuse/core', async () => {
  const actual = await vi.importActual<typeof VueUseCore>('@vueuse/core')
  const { computed } = await import('vue')
  return {
    ...actual,
    useBreakpoints: () => ({
      smaller: () => computed(() => state.mobileDisplay)
    })
  }
})

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: (key: string) =>
      key === 'Comfy.Sidebar.Location' ? state.sidebarLocation : undefined
  })
}))

vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: () => ({
    sidebarTab: {
      get activeSidebarTab() {
        return state.activeTab
      }
    }
  })
}))

vi.mock('@/composables/useAppMode', async () => {
  const { computed } = await import('vue')
  return {
    useAppMode: () => ({
      isBuilderMode: computed(() => state.isBuilderMode),
      isArrangeMode: computed(() => state.isArrangeMode)
    })
  }
})

vi.mock('@/stores/appModeStore', async () => {
  const { reactive, computed } = await import('vue')
  return {
    useAppModeStore: () =>
      reactive({ hasOutputs: computed(() => state.hasOutputs) })
  }
})

vi.mock('@/composables/useStablePrimeVueSplitterSizer', () => ({
  useStablePrimeVueSplitterSizer: () => ({ onResizeEnd })
}))

const passthroughStub = { template: '<div><slot /></div>' }

function leafStub(testId: string) {
  return { template: `<div data-testid="${testId}" />` }
}

const baseStubs = {
  Splitter: passthroughStub,
  SplitterPanel: passthroughStub,
  MobileDisplay: leafStub('mobile-display'),
  AppBuilder: leafStub('app-builder'),
  AppModeToolbar: leafStub('app-mode-toolbar'),
  ExtensionSlot: leafStub('extension-slot'),
  SideToolbar: leafStub('side-toolbar'),
  TopbarBadges: leafStub('topbar-badges'),
  TopbarSubscribeButton: leafStub('topbar-subscribe-button'),
  WorkflowTabs: leafStub('workflow-tabs'),
  LinearControls: leafStub('linear-controls'),
  LinearPreview: leafStub('linear-preview'),
  LinearProgressBar: leafStub('linear-progress-bar')
}

function renderView(overrides: Partial<ViewState> = {}) {
  Object.assign(state, overrides)
  return render(LinearView, {
    global: { stubs: baseStubs }
  })
}

const sampleTab = { id: 'assets' } as SidebarTabExtension

function getFlexContainer(container: Element): HTMLElement {
  // eslint-disable-next-line testing-library/no-node-access -- the layout wrapper that carries the flex-direction class has no ARIA role
  const el = container.querySelector<HTMLElement>('.flex-1')
  if (!el) throw new Error('flex container not found')
  return el
}

describe('LinearView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(state, {
      mobileDisplay: false,
      sidebarLocation: 'left',
      isBuilderMode: false,
      isArrangeMode: false,
      activeTab: null,
      hasOutputs: false
    } satisfies ViewState)
  })

  it('renders only the mobile display on small screens', () => {
    renderView({ mobileDisplay: true })

    expect(screen.getByTestId('mobile-display')).toBeInTheDocument()
    expect(screen.queryByTestId('workflow-tabs')).not.toBeInTheDocument()
    expect(screen.queryByTestId('linear-preview')).not.toBeInTheDocument()
  })

  it('renders the desktop layout with the center panel on larger screens', () => {
    renderView()

    expect(screen.queryByTestId('mobile-display')).not.toBeInTheDocument()
    expect(screen.getByTestId('workflow-tabs')).toBeInTheDocument()
    expect(screen.getByTestId('linear-header-progress-bar')).toBeInTheDocument()
    expect(screen.getByTestId('linear-preview')).toBeInTheDocument()
  })

  it('lays out left-to-right and shows the toolbar in app mode', () => {
    const { container } = renderView({
      sidebarLocation: 'left',
      activeTab: sampleTab,
      hasOutputs: true
    })

    expect(getFlexContainer(container)).toHaveClass('flex-row')
    expect(screen.getByTestId('side-toolbar')).toBeInTheDocument()
    expect(screen.getByTestId('app-mode-toolbar')).toBeInTheDocument()
    expect(screen.getByTestId('extension-slot')).toBeInTheDocument()
    expect(screen.getByTestId('linear-controls')).toBeInTheDocument()
  })

  it('reverses the layout when the sidebar is on the right', () => {
    const { container } = renderView({
      sidebarLocation: 'right',
      activeTab: sampleTab,
      hasOutputs: true
    })

    expect(getFlexContainer(container)).toHaveClass('flex-row-reverse')
    expect(screen.getByTestId('extension-slot')).toBeInTheDocument()
    expect(screen.getByTestId('linear-controls')).toBeInTheDocument()
  })

  it('omits both side panels when there is no active tab or output', () => {
    renderView({ activeTab: null, hasOutputs: false })

    expect(screen.queryByTestId('extension-slot')).not.toBeInTheDocument()
    expect(screen.queryByTestId('linear-controls')).not.toBeInTheDocument()
    expect(screen.getByTestId('linear-preview')).toBeInTheDocument()
  })

  it('shows the app builder in the right panel for left sidebar arrange mode', () => {
    renderView({
      sidebarLocation: 'left',
      isBuilderMode: true,
      isArrangeMode: true
    })

    expect(screen.getByTestId('app-builder')).toBeInTheDocument()
    expect(screen.queryByTestId('side-toolbar')).not.toBeInTheDocument()
    expect(screen.queryByTestId('app-mode-toolbar')).not.toBeInTheDocument()
  })

  it('shows the app builder in the left panel for right sidebar arrange mode', () => {
    renderView({
      sidebarLocation: 'right',
      isBuilderMode: true,
      isArrangeMode: true
    })

    expect(screen.getByTestId('app-builder')).toBeInTheDocument()
    expect(screen.queryByTestId('side-toolbar')).not.toBeInTheDocument()
  })

  it('blocks the native splitter resize start and runs the resize-end handler', () => {
    const preventDefault = vi.fn()
    render(LinearView, {
      global: {
        stubs: {
          ...baseStubs,
          Splitter: defineComponent({
            emits: ['resizestart', 'resizeend'],
            mounted() {
              this.$emit('resizestart', { originalEvent: { preventDefault } })
              this.$emit('resizeend')
            },
            template: '<div><slot /></div>'
          })
        }
      }
    })

    expect(preventDefault).toHaveBeenCalled()
    expect(onResizeEnd).toHaveBeenCalled()
  })
})
