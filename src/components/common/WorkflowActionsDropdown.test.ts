import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
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
    // A prior test's segment switch arms the module-level focus handoff;
    // a throwaway mount consumes it so it cannot steal focus mid-test.
    renderDropdown().unmount()
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

    // getByRole with a string name requires an exact accessible-name match,
    // so this also proves the name has no "mode, workflow actions" suffix.
    expect(
      screen.getByRole('button', { name: 'Enter app mode' })
    ).toBeInTheDocument()
  })

  it('flips the segment roles when app mode is active', () => {
    viewState.viewMode = 'app'
    viewState.displayViewMode = 'app'
    renderDropdown()

    const active = screen.getByRole('button', { name: /workflow actions/ })
    expect(active).toHaveAttribute('aria-label', 'App mode, workflow actions')
    expect(
      screen.getByRole('button', { name: 'Enter node graph' })
    ).toBeInTheDocument()
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
    // The switch must not also open the menu as a side effect.
    expect(
      screen.getByRole('button', { name: /workflow actions/ })
    ).toHaveAttribute('aria-expanded', 'false')
    expect(spies.trackUiButtonClicked).not.toHaveBeenCalled()
    expect(spies.markAsSeen).not.toHaveBeenCalled()
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
    // The keydown must not reach the trigger and open the menu.
    expect(
      screen.getByRole('button', { name: /workflow actions/ })
    ).toHaveAttribute('aria-expanded', 'false')
    expect(spies.trackUiButtonClicked).not.toHaveBeenCalled()
  })

  it('lets non-trigger keys bubble past the inactive segment', async () => {
    const { user } = renderDropdown()
    const bubbledKeys: string[] = []
    const recordKey = (event: KeyboardEvent) => bubbledKeys.push(event.key)
    document.addEventListener('keydown', recordKey)

    screen.getByRole('button', { name: 'Enter app mode' }).focus()
    await user.keyboard('r{Enter}')
    document.removeEventListener('keydown', recordKey)

    // App-level keybindings rely on keydowns bubbling; only the keys that
    // would open the reka trigger may be stopped.
    expect(bubbledKeys).toContain('r')
    expect(bubbledKeys).not.toContain('Enter')
  })

  it('opens the menu when the active segment is activated by keyboard', async () => {
    const { user } = renderDropdown()
    const active = screen.getByRole('button', { name: /workflow actions/ })

    active.focus()
    await user.keyboard('{Enter}')

    expect(spies.execute).not.toHaveBeenCalled()
    expect(active).toHaveAttribute('aria-expanded', 'true')
  })

  it('opens the menu on ArrowDown on the active segment', async () => {
    const { user } = renderDropdown()
    const active = screen.getByRole('button', { name: /workflow actions/ })

    active.focus()
    await user.keyboard('{ArrowDown}')

    expect(active).toHaveAttribute('aria-expanded', 'true')
  })

  it('forwards focus from the toggle group to the active segment', () => {
    renderDropdown()

    // Reka returns focus to the trigger div when the menu closes; the div
    // hands it on so focus lands on an interactive element.
    screen.getByRole('group', { name: 'Workflow actions' }).focus()

    expect(
      screen.getByRole('button', { name: /workflow actions/ })
    ).toHaveFocus()
  })

  it('focuses the newly mounted toggle after a segment-initiated switch', async () => {
    const { user, unmount } = renderDropdown()
    await user.click(screen.getByRole('button', { name: 'Enter app mode' }))

    // The mode flip unmounts this instance and mounts a fresh one in the
    // other mode's host.
    unmount()
    viewState.viewMode = 'app'
    viewState.displayViewMode = 'app'
    renderDropdown()
    await nextTick()

    expect(
      screen.getByRole('button', { name: /workflow actions/ })
    ).toHaveFocus()
  })
})
