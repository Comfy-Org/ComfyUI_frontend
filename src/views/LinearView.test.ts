import { render, screen } from '@testing-library/vue'
import type { DetachedWindowAPI } from 'happy-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SidebarTabExtension } from '@/types/extensionTypes'

import LinearView from './LinearView.vue'

interface ViewState {
  sidebarLocation: 'left' | 'right'
  isBuilderMode: boolean
  isArrangeMode: boolean
  activeTab: SidebarTabExtension | null
  hasOutputs: boolean
}

const state = vi.hoisted<ViewState>(() => ({
  sidebarLocation: 'left',
  isBuilderMode: false,
  isArrangeMode: false,
  activeTab: null,
  hasOutputs: false
}))

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
  useStablePrimeVueSplitterSizer: () => ({ onResizeEnd: vi.fn() })
}))

function setViewport(width: number) {
  const happyDOM = (window as unknown as { happyDOM?: DetachedWindowAPI })
    .happyDOM
  if (!happyDOM) {
    throw new Error('window.happyDOM is unavailable to set viewport')
  }
  happyDOM.setViewport({ width, height: 800 })
}

const DESKTOP_WIDTH = 1280
const MOBILE_WIDTH = 640

const passthroughStub = { template: '<div><slot /></div>' }

function leafStub(testId: string) {
  return { template: `<div data-testid="${testId}" />` }
}

const baseStubs = {
  Splitter: passthroughStub,
  SplitterPanel: passthroughStub,
  DockedAgentPanel: leafStub('docked-agent-panel'),
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

const sampleTab: SidebarTabExtension = {
  id: 'assets',
  title: 'Assets',
  type: 'custom',
  render: () => {}
}

function expectRenderedBefore(first: HTMLElement, second: HTMLElement) {
  expect(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy()
}

describe('LinearView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setViewport(DESKTOP_WIDTH)
    Object.assign(state, {
      sidebarLocation: 'left',
      isBuilderMode: false,
      isArrangeMode: false,
      activeTab: null,
      hasOutputs: false
    } satisfies ViewState)
  })

  it('renders only the mobile display on small screens', () => {
    setViewport(MOBILE_WIDTH)
    renderView()

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

  it('hosts the docked agent panel after the center content', () => {
    renderView()

    expectRenderedBefore(
      screen.getByTestId('linear-preview'),
      screen.getByTestId('docked-agent-panel')
    )
  })

  it('shows the toolbar and puts the active tab before the controls for a left sidebar', () => {
    renderView({
      sidebarLocation: 'left',
      activeTab: sampleTab,
      hasOutputs: true
    })

    expect(screen.getByTestId('side-toolbar')).toBeInTheDocument()
    expect(screen.getByTestId('app-mode-toolbar')).toBeInTheDocument()
    expectRenderedBefore(
      screen.getByTestId('extension-slot'),
      screen.getByTestId('linear-controls')
    )
  })

  it('puts the controls before the active tab when the sidebar is on the right', () => {
    renderView({
      sidebarLocation: 'right',
      activeTab: sampleTab,
      hasOutputs: true
    })

    expectRenderedBefore(
      screen.getByTestId('linear-controls'),
      screen.getByTestId('extension-slot')
    )
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
})
