import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import Toaster from './Toaster.vue'
import { useToast } from './toastStore'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { close: 'Close' } } }
})

describe('Toaster', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  function renderToaster() {
    return render(Toaster, { global: { plugins: [i18n] } })
  }

  it('stacks notifications and assigns severity roles', async () => {
    renderToaster()
    const toast = useToast()

    toast.success('Saved')
    toast.error('Could not save')
    await nextTick()

    const notifications = screen.getAllByTestId('toast')
    expect(notifications).toHaveLength(2)
    expect(notifications[0]).toHaveAttribute('role', 'status')
    expect(notifications[1]).toHaveAttribute('role', 'alert')
  })

  it('automatically dismisses a timed notification', async () => {
    vi.useFakeTimers()
    renderToaster()

    useToast().info('Uploaded', { duration: 1000 })
    await nextTick()
    expect(screen.getByText('Uploaded')).toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(1000)
    await nextTick()

    expect(screen.queryByText('Uploaded')).not.toBeInTheDocument()
  })

  it('dismisses a notification from its close button', async () => {
    const user = userEvent.setup()
    renderToaster()

    useToast().warning('Check settings')
    await nextTick()
    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByText('Check settings')).not.toBeInTheDocument()
  })
})
