import { useAppModeStore } from '@/stores/appModeStore'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import LinearWelcome from './LinearWelcome.vue'

vi.mock<unknown>(
  import('@/composables/useWorkflowTemplateSelectorDialog'),
  () => ({
    useWorkflowTemplateSelectorDialog: () => ({ show: vi.fn() })
  })
)

const i18n = createI18n({ legacy: false, locale: 'en', missingWarn: false })

function renderComponent(
  opts: { hasNodes?: boolean; hasOutputs?: boolean } = {}
) {
  Object.assign(useAppModeStore(), { hasNodes: opts.hasNodes ?? false })
  Object.assign(useAppModeStore(), { hasOutputs: opts.hasOutputs ?? false })
  return render(LinearWelcome, {
    global: { plugins: [i18n] }
  })
}

beforeEach(() => {
  vi.mocked(useAppModeStore().enterBuilder).mockImplementation(() => undefined)
})

describe('LinearWelcome', () => {
  beforeEach(() => {
    Object.assign(useAppModeStore(), { hasNodes: false })
    Object.assign(useAppModeStore(), { hasOutputs: false })
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
    expect(useAppModeStore().enterBuilder).toHaveBeenCalled()
  })
})
