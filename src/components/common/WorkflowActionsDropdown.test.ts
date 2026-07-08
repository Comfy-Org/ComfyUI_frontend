import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { ViewMode } from '@/utils/appMode'

import WorkflowActionsDropdown from './WorkflowActionsDropdown.vue'

const spies = vi.hoisted(() => ({
  execute: vi.fn(),
  trackUiButtonClicked: vi.fn(),
  markAsSeen: vi.fn()
}))

const viewState = vi.hoisted(() => ({
  viewMode: 'graph' as ViewMode,
  displayViewMode: 'graph' as ViewMode
}))

vi.mock('@/stores/appModeStore', async () => {
  const { computed, reactive } = await import('vue')
  return {
    useAppModeStore: () =>
      reactive({
        viewMode: computed(() => viewState.viewMode),
        displayViewMode: computed(() => viewState.displayViewMode)
      })
  }
})

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({ execute: spies.execute, commands: [] })
}))

vi.mock('@/platform/keybindings/keybindingStore', () => ({
  useKeybindingStore: () => ({
    getKeybindingByCommandId: () => ({ combo: { toString: () => 'Ctrl+L' } })
  })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ trackUiButtonClicked: spies.trackUiButtonClicked })
}))

vi.mock('@/composables/useWorkflowActionsMenu', async () => {
  const { ref } = await import('vue')
  return { useWorkflowActionsMenu: () => ({ menuItems: ref([]) }) }
})

vi.mock('@/composables/useNewMenuItemIndicator', async () => {
  const { ref } = await import('vue')
  return {
    useNewMenuItemIndicator: () => ({
      hasUnseenItems: ref(true),
      markAsSeen: spies.markAsSeen
    })
  }
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { shortcutSuffix: ' ({shortcut})' },
      breadcrumbsMenu: {
        graph: 'Graph',
        app: 'App',
        enterNodeGraph: 'Enter node graph',
        enterAppMode: 'Enter app mode',
        workflowActions: 'Workflow actions',
        activeModeWorkflowActions: '{mode} mode, workflow actions'
      }
    }
  }
})

function renderDropdown() {
  const user = userEvent.setup()
  const result = render(WorkflowActionsDropdown, {
    props: { source: 'test' },
    global: {
      plugins: [i18n],
      directives: { tooltip: {} },
      stubs: {
        DropdownMenuPortal: { template: '<div><slot /></div>' },
        DropdownMenuContent: { template: '<div role="menu"><slot /></div>' },
        WorkflowActionsList: true
      }
    }
  })
  return { ...result, user }
}

describe('WorkflowActionsDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    viewState.viewMode = 'graph'
    viewState.displayViewMode = 'graph'
  })

  it('keeps the active segment label in its accessible name alongside the actions label', () => {
    renderDropdown()

    // Graph is the active segment, so its name must contain the visible "Graph"
    // label (label-in-name) while still matching the "Workflow actions" trigger.
    const active = screen.getByRole('button', { name: /workflow actions/ })
    expect(active).toHaveAttribute('aria-label', 'Graph mode, workflow actions')
  })

  it('labels the inactive segment with its switch action only', () => {
    renderDropdown()

    const inactive = screen.getByRole('button', { name: 'Enter app mode' })
    expect(inactive).toHaveAttribute('aria-label', 'Enter app mode')
  })

  it('flips the segment roles when app mode is active', () => {
    viewState.viewMode = 'app'
    viewState.displayViewMode = 'app'
    renderDropdown()

    const active = screen.getByRole('button', { name: /workflow actions/ })
    expect(active).toHaveAttribute('aria-label', 'App mode, workflow actions')
    expect(
      screen.getByRole('button', { name: 'Enter node graph' })
    ).toHaveAttribute('aria-label', 'Enter node graph')
  })

  it('derives the active segment from the real mode, not the lagged display mode', () => {
    // Mid-animation: the mode has flipped to app but the display still lags.
    viewState.viewMode = 'app'
    viewState.displayViewMode = 'graph'
    renderDropdown()

    const active = screen.getByRole('button', { name: /workflow actions/ })
    expect(active).toHaveAttribute('aria-label', 'App mode, workflow actions')
    expect(
      screen.getByRole('button', { name: 'Enter node graph' })
    ).toBeInTheDocument()
  })

  it('carries the popup semantics only on the active segment', () => {
    renderDropdown()

    const active = screen.getByRole('button', { name: /workflow actions/ })
    expect(active).toHaveAttribute('aria-haspopup', 'menu')
    expect(active).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.getByRole('button', { name: 'Enter app mode' })
    ).not.toHaveAttribute('aria-haspopup')
  })

  it('toggles the view mode when the inactive segment is clicked', async () => {
    const { user } = renderDropdown()

    await user.click(screen.getByRole('button', { name: 'Enter app mode' }))

    expect(spies.execute).toHaveBeenCalledWith('Comfy.ToggleLinear', {
      metadata: { source: 'test' }
    })
  })

  it('opens the menu instead of toggling the mode when the active segment is clicked', async () => {
    const { user } = renderDropdown()
    const active = screen.getByRole('button', { name: /workflow actions/ })

    await user.click(active)

    expect(spies.execute).not.toHaveBeenCalled()
    expect(active).toHaveAttribute('aria-expanded', 'true')
    expect(spies.markAsSeen).toHaveBeenCalled()
    expect(spies.trackUiButtonClicked).toHaveBeenCalledWith({
      button_id: 'test',
      element_group: 'workflow_actions'
    })
  })

  it('closes the menu when the open trigger is clicked again', async () => {
    const { user } = renderDropdown()
    const active = screen.getByRole('button', { name: /workflow actions/ })

    await user.click(active)
    await user.click(active)

    expect(active).toHaveAttribute('aria-expanded', 'false')
  })

  it('switches mode when the inactive segment is activated by keyboard', async () => {
    const { user } = renderDropdown()
    const inactive = screen.getByRole('button', { name: 'Enter app mode' })

    inactive.focus()
    await user.keyboard('{Enter}')

    expect(spies.execute).toHaveBeenCalledWith('Comfy.ToggleLinear', {
      metadata: { source: 'test' }
    })
  })

  it('does not switch mode when the active segment is activated by keyboard', async () => {
    const { user } = renderDropdown()
    const active = screen.getByRole('button', { name: /workflow actions/ })

    active.focus()
    await user.keyboard('{Enter}')

    expect(spies.execute).not.toHaveBeenCalled()
  })

  it('opens the menu on ArrowDown on the active segment', async () => {
    const { user } = renderDropdown()
    const active = screen.getByRole('button', { name: /workflow actions/ })

    active.focus()
    await user.keyboard('{ArrowDown}')

    expect(active).toHaveAttribute('aria-expanded', 'true')
  })
})
