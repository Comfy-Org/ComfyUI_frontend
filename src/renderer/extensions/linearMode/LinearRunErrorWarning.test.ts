import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createI18n } from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import LinearRunErrorWarning from '@/renderer/extensions/linearMode/LinearRunErrorWarning.vue'

const mocks = vi.hoisted(() => ({
  viewErrorsInGraph: vi.fn()
}))

vi.mock('@/components/error/useViewErrorsInGraph', () => ({
  useViewErrorsInGraph: () => ({
    viewErrorsInGraph: mocks.viewErrorsInGraph
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      linearMode: {
        error: {
          workflowWarningTitle: 'Workflow has errors',
          workflowWarningDescription:
            'Review them in graph mode before running.',
          workflowWarningAction: 'View in Graph'
        }
      }
    }
  }
})

function renderWarning() {
  const user = userEvent.setup()
  const result = render(LinearRunErrorWarning, {
    global: { plugins: [i18n] }
  })

  return { ...result, user }
}

describe('LinearRunErrorWarning', () => {
  beforeEach(() => {
    mocks.viewErrorsInGraph.mockReset()
  })

  it('shows the app mode workflow error warning', () => {
    renderWarning()

    expect(screen.getByText('Workflow has errors')).toBeInTheDocument()
    expect(
      screen.getByText('Review them in graph mode before running.')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'View in Graph' })
    ).toBeInTheDocument()
  })

  it('opens graph errors when the action is clicked', async () => {
    const { user } = renderWarning()

    await user.click(screen.getByRole('button', { name: 'View in Graph' }))

    expect(mocks.viewErrorsInGraph).toHaveBeenCalledOnce()
  })
})
