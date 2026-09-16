import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { useAppModeStore } from '@/stores/appModeStore'

import AppModeToolbar from './AppModeToolbar.vue'

const appModeState = vi.hoisted(() => ({
  enableAppBuilder: true
}))

vi.mock<unknown>(import('@/composables/useAppMode'), () => ({
  useAppMode: () => ({
    enableAppBuilder: appModeState.enableAppBuilder,
    isAppMode: { value: false },
    isBuilderMode: { value: false },
    isSelectMode: { value: false }
  })
}))

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
    appModeState.enableAppBuilder = true
    Object.assign(useAppModeStore(), { hasNodes: true })
    vi.mocked(useAppModeStore().enterBuilder).mockResolvedValue(undefined)
  })

  it('shows an enabled build button and enters the builder on click', async () => {
    const { user } = renderToolbar()

    const button = screen.getByRole('button', { name: BUILD_AN_APP })
    expect(button).toBeEnabled()

    await user.click(button)

    expect(useAppModeStore().enterBuilder).toHaveBeenCalled()
  })

  it('disables the build button when there are no nodes', () => {
    Object.assign(useAppModeStore(), { hasNodes: false })
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
