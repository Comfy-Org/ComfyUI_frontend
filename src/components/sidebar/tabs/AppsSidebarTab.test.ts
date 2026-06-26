import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import AppsSidebarTab from './AppsSidebarTab.vue'

const execute = vi.hoisted(() => vi.fn())

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({ execute })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { beta: 'Beta' },
      linearMode: {
        appModeToolbar: {
          apps: 'Apps',
          create: 'Create',
          createApp: 'Create app',
          appsEmptyMessage: 'No apps yet',
          appsEmptyMessageAction: 'Create one to get started'
        }
      }
    }
  }
})

function renderTab() {
  const user = userEvent.setup()
  const result = render(AppsSidebarTab, {
    global: {
      plugins: [i18n],
      stubs: {
        BaseWorkflowsSidebarTab: {
          template:
            '<div><slot name="header-actions" :has-results="true" /><slot name="empty-state" /></div>'
        },
        Button: {
          inheritAttrs: false,
          template:
            '<button v-bind="$attrs" @click="$emit(\'click\', $event)"><slot /></button>'
        },
        NoResultsPlaceholder: {
          emits: ['action'],
          template: '<button @click="$emit(\'action\')">empty</button>'
        }
      }
    }
  })
  return { ...result, user }
}

describe('AppsSidebarTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('runs the new-workflow command when the create action is clicked', async () => {
    const { user } = renderTab()

    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(execute).toHaveBeenCalledWith('Comfy.NewBlankWorkflow')
  })

  it('runs the new-workflow command from the empty-state action', async () => {
    const { user } = renderTab()

    await user.click(screen.getByRole('button', { name: 'empty' }))

    expect(execute).toHaveBeenCalledWith('Comfy.NewBlankWorkflow')
  })
})
