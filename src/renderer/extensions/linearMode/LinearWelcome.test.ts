import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import LinearWelcome from './LinearWelcome.vue'

const { appModeState, enterBuilder } = vi.hoisted(() => ({
  appModeState: { hasNodes: false, hasOutputs: false },
  enterBuilder: vi.fn()
}))

vi.mock('@/stores/appModeStore', async () => {
  const { computed, reactive } = await import('vue')
  return {
    useAppModeStore: () =>
      reactive({
        hasNodes: computed(() => appModeState.hasNodes),
        hasOutputs: computed(() => appModeState.hasOutputs),
        enterBuilder
      })
  }
})

const i18n = createI18n({ legacy: false, locale: 'en', missingWarn: false })

function renderComponent(
  opts: { hasNodes?: boolean; hasOutputs?: boolean } = {}
) {
  appModeState.hasNodes = opts.hasNodes ?? false
  appModeState.hasOutputs = opts.hasOutputs ?? false
  return render(LinearWelcome, {
    global: {
      plugins: [i18n],
      stubs: {
        LinearGetStarted: {
          template: '<div data-testid="get-started-stub" />'
        }
      }
    }
  })
}

describe('LinearWelcome', () => {
  beforeEach(() => {
    appModeState.hasNodes = false
    appModeState.hasOutputs = false
    vi.clearAllMocks()
  })

  it('shows the get started page when there are no nodes', () => {
    renderComponent({ hasNodes: false })
    expect(screen.getByTestId('get-started-stub')).toBeInTheDocument()
    expect(screen.queryByTestId('linear-welcome')).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('linear-welcome-build-app')
    ).not.toBeInTheDocument()
  })

  it('shows build app button when there are nodes but no outputs', () => {
    renderComponent({ hasNodes: true, hasOutputs: false })
    expect(screen.queryByTestId('get-started-stub')).not.toBeInTheDocument()
    expect(screen.getByTestId('linear-welcome-build-app')).toBeInTheDocument()
  })

  it('shows the ready-to-run card without the build button when the app has outputs', () => {
    renderComponent({ hasNodes: true, hasOutputs: true })
    expect(screen.getByTestId('linear-welcome')).toBeInTheDocument()
    expect(
      screen.queryByTestId('linear-welcome-build-app')
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId('get-started-stub')).not.toBeInTheDocument()
  })

  it('clicking build app button calls enterBuilder', async () => {
    const user = userEvent.setup()
    renderComponent({ hasNodes: true, hasOutputs: false })
    await user.click(screen.getByTestId('linear-welcome-build-app'))
    expect(enterBuilder).toHaveBeenCalled()
  })
})
