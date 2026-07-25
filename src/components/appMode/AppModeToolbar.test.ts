import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import AppModeToolbar from './AppModeToolbar.vue'

const appModeState = vi.hoisted(() => ({
  enableAppBuilder: true,
  hasNodes: true
}))
const enterBuilder = vi.hoisted(() => vi.fn())

vi.mock('@/composables/useAppMode', () => ({
  useAppMode: () => ({ enableAppBuilder: appModeState.enableAppBuilder })
}))

vi.mock('@/stores/appModeStore', async () => {
  const { computed, reactive } = await import('vue')
  return {
    useAppModeStore: () =>
      reactive({
        enterBuilder,
        hasNodes: computed(() => appModeState.hasNodes)
      })
  }
})

const BUILD_AN_APP = 'Build an app'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      linearMode: { appModeToolbar: { buildAnApp: BUILD_AN_APP } }
    }
  }
})

function renderToolbar() {
  const user = userEvent.setup()
  const result = render(AppModeToolbar, {
    global: {
      plugins: [i18n],
      stubs: {
        WorkflowActionsDropdown: true
      }
    }
  })
  return { ...result, user }
}

describe('AppModeToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    appModeState.enableAppBuilder = true
    appModeState.hasNodes = true
  })

  it('shows an enabled build button and enters the builder on click', async () => {
    const { user } = renderToolbar()

    const button = screen.getByRole('button', { name: BUILD_AN_APP })
    expect(button).toBeEnabled()

    await user.click(button)

    expect(enterBuilder).toHaveBeenCalled()
  })

  it('disables the build button when there are no nodes', () => {
    appModeState.hasNodes = false
    renderToolbar()

    expect(screen.getByRole('button', { name: BUILD_AN_APP })).toBeDisabled()
  })

  it('hides the build button when app building is disabled', () => {
    appModeState.enableAppBuilder = false
    renderToolbar()

    expect(
      screen.queryByRole('button', { name: BUILD_AN_APP })
    ).not.toBeInTheDocument()
  })
})
