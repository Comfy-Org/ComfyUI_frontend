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
  expect(await screen.findAllByRole('alert')).toHaveLength(2)
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

  it('Close still works after an Escape another handler already prevented', async () => {
    const onClose = await renderToasts()
    const preventEscape = (event: KeyboardEvent) => event.preventDefault()
    document.addEventListener('keydown', preventEscape)
    onTestFinished(() => document.removeEventListener('keydown', preventEscape))

    await userEvent.keyboard('{Escape}')
    const [, successClose] = screen.getAllByRole('button', { name: 'Close' })
    await userEvent.click(successClose)

    expect(onClose.mock.calls).toEqual([['success']])
  })
})
