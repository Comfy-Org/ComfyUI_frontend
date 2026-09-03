import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { ZIndex } from '@primeuix/utils/zindex'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  const dialogs: HTMLElement[] = []

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    dialogs.splice(0).forEach((dialog) => ZIndex.clear(dialog))
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

  it('lifts a new notification above an open dialog', async () => {
    renderToaster()
    const dialog = document.createElement('div')
    dialogs.push(dialog)
    ZIndex.set('modal', dialog, 1700)

    useToast().info('Ready')
    await nextTick()

    expect(
      Number(screen.getByTestId('toast-viewport').style.zIndex)
    ).toBeGreaterThan(Number(dialog.style.zIndex))
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

  it('preserves notifications when Escape is pressed', async () => {
    const user = userEvent.setup()
    renderToaster()

    const toast = useToast()
    toast.info('First')
    toast.warning('Second')
    await nextTick()

    await user.keyboard('{Escape}')

    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
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
