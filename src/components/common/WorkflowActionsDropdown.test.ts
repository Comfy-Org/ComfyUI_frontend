import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import WorkflowActionsDropdown from './WorkflowActionsDropdown.vue'

const execute = vi.hoisted(() => vi.fn())

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({ displayLinearMode: false })
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({ execute, commands: [] })
}))

vi.mock('@/platform/keybindings/keybindingStore', () => ({
  useKeybindingStore: () => ({ getKeybindingByCommandId: () => undefined })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ trackUiButtonClicked: vi.fn() })
}))

vi.mock('@/composables/useWorkflowActionsMenu', async () => {
  const { ref } = await import('vue')
  return { useWorkflowActionsMenu: () => ({ menuItems: ref([]) }) }
})

vi.mock('@/composables/useNewMenuItemIndicator', async () => {
  const { ref } = await import('vue')
  return {
    useNewMenuItemIndicator: () => ({
      hasUnseenItems: ref(false),
      markAsSeen: vi.fn()
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
        DropdownMenuRoot: { template: '<div><slot /></div>' },
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

    expect(execute).toHaveBeenCalledWith('Comfy.ToggleLinear', {
      metadata: { source: 'test' }
    })
  })
})
