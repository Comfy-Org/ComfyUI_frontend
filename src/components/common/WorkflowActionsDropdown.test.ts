import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import WorkflowActionsDropdown from './WorkflowActionsDropdown.vue'

const spies = vi.hoisted(() => ({
  execute: vi.fn(),
  trackUiButtonClicked: vi.fn(),
  markAsSeen: vi.fn()
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({ displayLinearMode: false })
}))

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
        workflowActions: 'Workflow actions'
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
        // Emits update:open on mount so handleOpen's telemetry path is exercised.
        DropdownMenuRoot: {
          emits: ['update:open'],
          mounted() {
            this.$emit('update:open', true)
          },
          template: '<div><slot /></div>'
        },
        DropdownMenuTrigger: { template: '<div><slot /></div>' },
        DropdownMenuPortal: { template: '<div><slot /></div>' },
        DropdownMenuContent: { template: '<div><slot /></div>' },
        WorkflowActionsList: true,
        Button: {
          inheritAttrs: false,
          template:
            '<button v-bind="$attrs" @click="$emit(\'click\', $event)"><slot /></button>'
        }
      }
    }
  })
  return { ...result, user }
}

describe('WorkflowActionsDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps the active segment label in its accessible name alongside the actions label', () => {
    renderDropdown()

    // Graph is the active segment, so its name must contain the visible "Graph"
    // label (label-in-name) while still matching the "Workflow actions" trigger.
    const active = screen.getByRole('button', { name: /Workflow actions/ })
    expect(active).toHaveAttribute('aria-label', 'Graph Workflow actions')
  })

  it('labels the inactive segment with its switch action only', () => {
    renderDropdown()

    const inactive = screen.getByRole('button', { name: 'Enter app mode' })
    expect(inactive).toHaveAttribute('aria-label', 'Enter app mode')
  })

  it('toggles the view mode when the inactive segment is clicked', async () => {
    const { user } = renderDropdown()

    await user.click(screen.getByRole('button', { name: 'Enter app mode' }))

    expect(spies.execute).toHaveBeenCalledWith('Comfy.ToggleLinear', {
      metadata: { source: 'test' }
    })
  })

  it('does not toggle the view mode when the active segment is clicked', async () => {
    const { user } = renderDropdown()

    await user.click(screen.getByRole('button', { name: /Workflow actions/ }))

    expect(spies.execute).not.toHaveBeenCalled()
  })

  it('switches mode when the inactive segment is activated by keyboard', async () => {
    const { user } = renderDropdown()
    const inactive = screen.getByRole('button', { name: 'Enter app mode' })

    inactive.focus()
    await user.keyboard('{Enter}')

    // The keydown guard stops the event bubbling to the trigger, but native
    // button activation still switches mode.
    expect(spies.execute).toHaveBeenCalledWith('Comfy.ToggleLinear', {
      metadata: { source: 'test' }
    })
  })

  it('does not switch mode when the active segment is activated by keyboard', async () => {
    const { user } = renderDropdown()
    const active = screen.getByRole('button', { name: /Workflow actions/ })

    active.focus()
    await user.keyboard('{Enter}')

    expect(spies.execute).not.toHaveBeenCalled()
  })

  it('marks new items as seen and reports telemetry when the menu opens', () => {
    renderDropdown()

    expect(spies.markAsSeen).toHaveBeenCalled()
    expect(spies.trackUiButtonClicked).toHaveBeenCalledWith({
      button_id: 'test',
      element_group: 'workflow_actions'
    })
  })
})
