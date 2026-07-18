import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createI18n } from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import LinearRunErrorWarning from '@/renderer/extensions/linearMode/LinearRunErrorWarning.vue'
import { LINEAR_RUN_ERROR_WARNING_DESCRIPTION_ID } from '@/renderer/extensions/linearMode/linearRunErrorWarningIds'

const mocks = vi.hoisted(() => ({
  overlayMessage: 'KSampler is missing a required input: model',
  overlayTitle: 'Required input missing',
  viewErrorsInGraph: vi.fn()
}))

vi.mock('@/components/error/useErrorOverlayState', () => ({
  useErrorOverlayState: () => ({
    overlayMessage: mocks.overlayMessage,
    overlayTitle: mocks.overlayTitle
  })
}))

vi.mock('@/composables/useViewErrorsInGraph', () => ({
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
        fixErrors: 'Fix errors'
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

  it('shows the current error overlay title and message without a close action', () => {
    renderWarning()

    const warning = screen.getByRole('status')
    expect(warning).toHaveTextContent('Required input missing')
    expect(warning).toHaveTextContent(
      'KSampler is missing a required input: model'
    )
    expect(screen.getByText('Required input missing')).toHaveAttribute(
      'title',
      'Required input missing'
    )
    const description = screen.getByTestId(
      'linear-validation-warning-description'
    )
    expect(description).toHaveAttribute(
      'id',
      LINEAR_RUN_ERROR_WARNING_DESCRIPTION_ID
    )
    expect(description).toHaveTextContent('Required input missing')
    expect(description).toHaveTextContent(
      'KSampler is missing a required input: model'
    )
    expect(description).not.toHaveTextContent('Fix errors')
    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument()
  })

  it('opens graph errors when the action is clicked', async () => {
    const { user } = renderWarning()

    await user.click(screen.getByRole('button', { name: 'Fix errors' }))

    expect(mocks.viewErrorsInGraph).toHaveBeenCalledOnce()
  })
})
