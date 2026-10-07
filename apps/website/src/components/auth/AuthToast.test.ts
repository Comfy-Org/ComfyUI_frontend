import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { authToast, dismissAllAuthToasts } from '@/config/auth-toast-state'
import AuthToast from './AuthToast.vue'

beforeEach(dismissAllAuthToasts)

function shownToasts() {
  return within(screen.getByRole('region')).queryAllByRole('alert')
}

describe('AuthToast', () => {
  it('shows a toast raised before the host mounted', async () => {
    authToast.error('Error', { description: 'Too early' })

    render(AuthToast)

    await vi.waitFor(() =>
      expect(shownToasts()[0]).toHaveTextContent('Too early')
    )
  })

  it('dismisses a toast with a duration once that many milliseconds pass', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    authToast.success('Signed out', { duration: 5000 })
    render(AuthToast)

    await vi.advanceTimersByTimeAsync(4999)
    expect(shownToasts()).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(shownToasts()).toHaveLength(0)
  })

  it('keeps a toast without a duration until it is closed', async () => {
    render(AuthToast)
    authToast.error('Error', { description: 'Sticky' })
    await vi.waitFor(() => expect(shownToasts()).toHaveLength(1))

    await vi.advanceTimersByTimeAsync(60_000)
    expect(shownToasts()).toHaveLength(1)

    await userEvent.setup().click(screen.getByRole('button', { name: 'Close' }))
    expect(shownToasts()).toHaveLength(0)
  })

  it.for([
    ['error', 'assertive'],
    ['warning', 'assertive'],
    ['success', 'polite']
  ] as const)('announces a %s toast %sly', async ([kind, politeness]) => {
    render(AuthToast)
    authToast[kind]('Title', { description: 'Description' })

    expect(
      await screen.findByText('Title. Description', {
        selector: `[aria-live="${politeness}"] > p`
      })
    ).toBeInTheDocument()
  })
})
