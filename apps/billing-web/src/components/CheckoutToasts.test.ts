import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'

import CheckoutToasts from '@/components/CheckoutToasts.vue'
import { createBillingI18n } from '@/i18n'

async function renderToasts() {
  const onClose = vi.fn<(key: string) => void>()
  render(CheckoutToasts, {
    props: {
      toasts: [
        { key: 'failure', severity: 'error', summary: 'Error', detail: 'x' },
        { key: 'success', severity: 'success', summary: 'Done' }
      ],
      closeLabel: 'Close',
      onClose
    },
    global: { plugins: [createBillingI18n()] }
  })
  await screen.findAllByRole('alert')
  return onClose
}

describe('CheckoutToasts', () => {
  it('Escape outside the toasts closes none of them', async () => {
    const onClose = await renderToasts()

    await userEvent.keyboard('{Escape}')

    expect(onClose).not.toHaveBeenCalled()
  })

  it('Escape on a focused toast closes only that toast', async () => {
    const onClose = await renderToasts()
    const [failureClose] = screen.getAllByRole('button', { name: 'Close' })

    failureClose.focus()
    await userEvent.keyboard('{Escape}')

    expect(onClose.mock.calls).toEqual([['failure']])
  })
})
