import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import LinearWelcome from './LinearWelcome.vue'

const { hasNodes, hasOutputs, enterBuilder } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref } = require('vue')
  return {
    hasNodes: ref(false),
    hasOutputs: ref(false),
    enterBuilder: vi.fn()
  }
})

vi.mock('@/composables/useAppMode', () => ({
  useAppMode: () => ({ setMode: vi.fn() })
}))

vi.mock('@/stores/appModeStore', () => ({
  useAppModeStore: () => ({
    hasNodes,
    hasOutputs,
    enterBuilder
  })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    activeWorkflow: null
  })
}))

const i18n = createI18n({ legacy: false, locale: 'en', missingWarn: false })

function renderComponent(
  opts: { hasNodes?: boolean; hasOutputs?: boolean } = {}
) {
  hasNodes.value = opts.hasNodes ?? false
  hasOutputs.value = opts.hasOutputs ?? false
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
    hasNodes.value = false
    hasOutputs.value = false
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

  it('clicking build app button calls enterBuilder', async () => {
    const user = userEvent.setup()
    renderComponent({ hasNodes: true, hasOutputs: false })
    await user.click(screen.getByTestId('linear-welcome-build-app'))
    expect(enterBuilder).toHaveBeenCalled()
  })
})
