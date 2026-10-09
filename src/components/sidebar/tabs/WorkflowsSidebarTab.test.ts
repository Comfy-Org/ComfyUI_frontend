import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import messages from '@/locales/en/main.json'
import WorkflowsSidebarTab from './WorkflowsSidebarTab.vue'

const mocks = vi.hoisted(() => ({ show: vi.fn() }))
vi.mock('@/platform/distribution/types', () => ({ isCloud: true }))
vi.mock(
  '@/platform/workflow/library/composables/useTestWorkflowLibraryDialog',
  () => ({
    useTestWorkflowLibraryDialog: () => ({ show: mocks.show })
  })
)
vi.mock('./BaseWorkflowsSidebarTab.vue', () => ({
  default: {
    template:
      '<aside><slot name="header-actions" /><slot name="footer" /></aside>'
  }
}))

describe('Workflows library entry', () => {
  it('opens the library from its labelled sidebar action', async () => {
    const user = userEvent.setup()
    render(WorkflowsSidebarTab, {
      global: {
        plugins: [
          createI18n({
            legacy: false,
            locale: 'en',
            messages: { en: messages }
          })
        ]
      }
    })
    const button = screen.getByRole('button', { name: 'Test Workflow Library' })
    expect(button).toHaveTextContent('Test Workflow Library')
    await user.click(button)
    expect(mocks.show).toHaveBeenCalledOnce()
  })
})
