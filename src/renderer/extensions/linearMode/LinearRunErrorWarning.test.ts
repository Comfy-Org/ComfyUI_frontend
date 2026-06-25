import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createI18n } from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import LinearRunErrorWarning from '@/renderer/extensions/linearMode/LinearRunErrorWarning.vue'

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
          goto: 'Show errors in graph'
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

  it('shows the current error overlay title and message without a close action', () => {
    renderWarning()

    const warning = screen.getByRole('status')
    expect(warning).toHaveTextContent('Required input missing')
    expect(warning).toHaveTextContent(
      'KSampler is missing a required input: model'
    )
    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument()
  })

  it('opens graph errors when the action is clicked', async () => {
    const { user } = renderWarning()

    await user.click(
      screen.getByRole('button', { name: 'Show errors in graph' })
    )

    expect(mocks.viewErrorsInGraph).toHaveBeenCalledOnce()
  })
})
