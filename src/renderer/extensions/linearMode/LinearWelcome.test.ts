import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import LinearWelcome from './LinearWelcome.vue'

const hasNodes = ref(false)
const hasOutputs = ref(false)
const enterBuilder = vi.fn()

vi.mock('@/composables/useAppMode', () => ({
  useAppMode: () => ({ setMode: vi.fn() })
}))

vi.mock('@/composables/useWorkflowTemplateSelectorDialog', () => ({
  useWorkflowTemplateSelectorDialog: () => ({ show: vi.fn() })
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
    global: { plugins: [i18n] }
  })
}

describe('LinearWelcome', () => {
  beforeEach(() => {
    hasNodes.value = false
    hasOutputs.value = false
    vi.clearAllMocks()
  })

  it('shows empty workflow text when there are no nodes', () => {
    renderComponent({ hasNodes: false })
    expect(
      screen.getByTestId('linear-welcome-empty-workflow')
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId('linear-welcome-build-app')
    ).not.toBeInTheDocument()
  })

  it('shows build app button when there are nodes but no outputs', () => {
    renderComponent({ hasNodes: true, hasOutputs: false })
    expect(
      screen.queryByTestId('linear-welcome-empty-workflow')
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('linear-welcome-build-app')).toBeInTheDocument()
  })

  it('clicking build app button calls enterBuilder', async () => {
    const user = userEvent.setup()
    renderComponent({ hasNodes: true, hasOutputs: false })
    await user.click(screen.getByTestId('linear-welcome-build-app'))
    expect(enterBuilder).toHaveBeenCalled()
  })
})
