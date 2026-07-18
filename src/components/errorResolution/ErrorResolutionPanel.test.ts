import { createTestingPinia } from '@pinia/testing'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { setViewport } from '@/components/searchbox/v2/__test__/testUtils'

import ErrorResolutionPanel from './ErrorResolutionPanel.vue'

vi.mock('@/scripts/app', () => ({
  app: {
    rootGraph: {
      serialize: vi.fn(() => ({})),
      getNodeById: vi.fn()
    }
  }
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  getNodeByExecutionId: vi.fn(),
  getRootParentNode: vi.fn(() => null),
  forEachNode: vi.fn(),
  mapAllNodes: vi.fn(() => [])
}))

vi.mock('@/composables/useCopyToClipboard', () => ({
  useCopyToClipboard: vi.fn(() => ({
    copyToClipboard: vi.fn()
  }))
}))

vi.mock('@/composables/canvas/useFocusNode', () => ({
  useFocusNode: vi.fn(() => ({
    focusNode: vi.fn()
  }))
}))

describe('ErrorResolutionPanel.vue', () => {
  let i18n: ReturnType<typeof createI18n>

  beforeEach(() => {
    vi.clearAllMocks()
    i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: {
        en: {
          errorResolution: {
            title: 'Fix workflow errors',
            backToApp: 'Back to App Mode',
            allResolved: 'All errors resolved',
            allResolvedDesc: 'You are ready to go back to App Mode.',
            showErrors: 'Show errors',
            hideErrors: 'Hide errors'
          },
          rightSidePanel: {
            noErrors: 'No errors',
            noneSearchDesc: 'No results found',
            errorsDetected: 'Error detected | Errors detected',
            resolveBeforeRun: 'Resolve before running the workflow',
            expand: 'Expand',
            collapse: 'Collapse'
          }
        }
      }
    })
  })

  function renderComponent(initialState = {}) {
    const user = userEvent.setup()
    const result = render(ErrorResolutionPanel, {
      global: {
        plugins: [
          PrimeVue,
          i18n,
          createTestingPinia({
            createSpy: vi.fn,
            initialState
          })
        ],
        stubs: {
          AsyncSearchInput: {
            template: '<input />'
          }
        }
      }
    })
    return { user, ...result }
  }

  it('shows the resolved state with a back button when no errors exist', async () => {
    const { user, emitted } = renderComponent()

    expect(
      screen.getByRole('status'),
      'the resolved transition is announced via the persistent live region'
    ).toHaveTextContent('All errors resolved')
    expect(screen.getAllByText('All errors resolved')).not.toHaveLength(0)
    expect(screen.queryByTestId('errors-summary-hero')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Back to App Mode/i }))
    expect(emitted('back')).toHaveLength(1)
  })

  it('shows the error list when errors exist', () => {
    renderComponent({
      executionError: {
        lastPromptError: {
          type: 'prompt_no_outputs',
          message: 'Server Error: No outputs',
          details: 'Error details'
        }
      }
    })

    expect(screen.getByTestId('errors-summary-hero')).toBeInTheDocument()
    expect(screen.queryByText('All errors resolved')).not.toBeInTheDocument()
  })

  it('shows a collapsible top bar with the error count on narrow viewports', async () => {
    setViewport({ width: 375, height: 800 })
    const { user, emitted } = renderComponent({
      executionError: {
        lastPromptError: {
          type: 'prompt_no_outputs',
          message: 'Server Error: No outputs',
          details: 'Error details'
        }
      }
    })

    expect(
      screen.getByText('Error detected'),
      'the top bar shows the error count summary'
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId('errors-summary-hero'),
      'the hero is replaced by the top bar on narrow viewports'
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Hide errors' }))
    await waitFor(() => {
      expect(
        screen.queryByTestId('selection-context-strip')
      ).not.toBeInTheDocument()
    })
    expect(
      screen.getByRole('button', { name: 'Show errors' })
    ).toBeInTheDocument()

    await user.click(screen.getByTestId('error-resolution-back'))
    expect(emitted('back')).toHaveLength(1)

    setViewport({ width: 1024, height: 768 })
  })
})
