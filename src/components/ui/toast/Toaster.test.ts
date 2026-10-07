import { ZIndex } from '@primeuix/utils/zindex'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { MODAL_Z_BASE, vRekaZIndex } from '@/components/dialog/vRekaZIndex'

import type { ToastId } from '@/types/toastId'

import Toaster from './Toaster.vue'
import { useToast } from './toastStore'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { close: 'Close' },
      toastMessages: {
        notificationsLabel: 'Notification',
        notificationsViewportLabel: 'Notifications ({hotkey})'
      }
    }
  }
})

function renderToaster() {
  return render(Toaster, { global: { plugins: [i18n] } })
}

function pressEscapePreventedUpstream() {
  const prevent = (event: KeyboardEvent) => event.preventDefault()
  window.addEventListener('keydown', prevent, { capture: true })
  window.dispatchEvent(
    new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Escape'
    })
  )
  window.removeEventListener('keydown', prevent, { capture: true })
}

describe('Toaster', () => {
  it('announces errors and warnings assertively and other notifications politely', async () => {
    renderToaster()
    const toast = useToast()

    toast.success('Saved')
    toast.loading('Uploading')
    toast.error('Could not save', { description: 'Disk is full' })
    toast.warning('Pop-up blocked', {
      action: { label: 'Try again', onClick: vi.fn() }
    })
    await nextTick()

    const polite = screen.getByRole('status', { name: 'Notification' })
    const assertive = screen.getByRole('alert', { name: 'Notification' })
    expect(polite).toHaveTextContent('SavedUploading')
    expect(assertive).toHaveTextContent(
      'Could not save. Disk is fullPop-up blocked. Try again'
    )
    expect(polite).toHaveAttribute('aria-atomic', 'false')
    expect(assertive).toHaveAttribute('aria-atomic', 'false')
  })

  it('renders each notification once outside the live regions', async () => {
    renderToaster()

    useToast().error('Save failed', { description: 'Try another location' })
    await nextTick()
    await vi.advanceTimersByTimeAsync(1000)

    expect(screen.getByTestId('toast')).toHaveAttribute('aria-live', 'off')
    expect(document.body.textContent.match(/Save failed/g)).toHaveLength(2)
  })

  it('runs a notification action from its button', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    renderToaster()

    useToast().warning('Pop-up blocked', {
      action: { label: 'Try again', onClick },
      description: 'Allow pop-ups and try again'
    })
    await nextTick()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(onClick).toHaveBeenCalledOnce()
    expect(screen.getByTestId('toast')).toHaveTextContent(
      'Pop-up blockedAllow pop-ups and try again'
    )
  })

  it('labels the notification regions in the active locale', async () => {
    render(Toaster, {
      global: {
        plugins: [
          createI18n({
            legacy: false,
            locale: 'fr',
            messages: {
              fr: {
                g: { close: 'Fermer' },
                toastMessages: {
                  notificationsLabel: 'Notification FR',
                  notificationsViewportLabel: 'Notifications FR ({hotkey})'
                }
              }
            }
          })
        ]
      }
    })

    useToast().info('Enregistré')
    await nextTick()

    expect(
      screen.getByRole('region', { name: 'Notifications FR (F8)' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('status', { name: 'Notification FR' })
    ).toHaveTextContent('Enregistré')
  })

  it('lifts a new notification above an open dialog', async () => {
    renderToaster()
    render({
      directives: { rekaZIndex: vRekaZIndex },
      template: '<div v-reka-z-index data-testid="dialog" />'
    })

    useToast().info('Ready')
    await nextTick()

    expect(
      Number(screen.getByTestId('toast-viewport').style.zIndex)
    ).toBeGreaterThan(Number(screen.getByTestId('dialog').style.zIndex))
  })

  it('stays out of the modal stacking order while idle', async () => {
    renderToaster()
    const id = useToast().info('Ready')
    await nextTick()

    useToast().dismiss(id)
    await nextTick()

    expect(ZIndex.getCurrent('modal')).toBeLessThan(MODAL_Z_BASE)
    expect(screen.queryByTestId('toast-viewport')).not.toBeInTheDocument()
  })

  it('automatically dismisses a timed notification', async () => {
    renderToaster()

    useToast().info('Uploaded', { duration: 1000 })
    await nextTick()
    expect(screen.getByTestId('toast')).toHaveTextContent('Uploaded')

    await vi.advanceTimersByTimeAsync(1000)
    await nextTick()

    expect(screen.queryByTestId('toast')).not.toBeInTheDocument()
  })

  it.for([
    {
      name: 'the pointer closed the last notification',
      pauseAndEmpty: async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
        await user.hover(screen.getByTestId('toast'))
        await user.click(screen.getByRole('button', { name: 'Close' }))
      }
    },
    {
      name: 'the last notification was dismissed while the window was blurred',
      pauseAndEmpty: async (id: ToastId) => {
        window.dispatchEvent(new Event('blur'))
        useToast().dismiss(id)
        await nextTick()
        window.dispatchEvent(new Event('focus'))
      }
    }
  ])('times out later notifications after $name', async ({ pauseAndEmpty }) => {
    renderToaster()
    const id = useToast().loading('Waiting for payment')
    await nextTick()

    await pauseAndEmpty(id)
    await nextTick()
    useToast().success('Payment complete', { duration: 1000 })
    await nextTick()
    await vi.advanceTimersByTimeAsync(1000)
    await nextTick()

    expect(screen.queryByText('Payment complete')).not.toBeInTheDocument()
  })

  it('hides held notifications and restarts their timers when shown', async () => {
    renderToaster()
    const toast = useToast()
    toast.held = true

    toast.info('Uploaded', { duration: 1000 })
    await nextTick()
    await vi.advanceTimersByTimeAsync(5000)
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument()

    toast.held = false
    await nextTick()
    expect(screen.getByTestId('toast')).toHaveTextContent('Uploaded')

    await vi.advanceTimersByTimeAsync(1000)
    await nextTick()
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument()
  })

  it('preserves notifications when Escape is pressed', async () => {
    const user = userEvent.setup()
    renderToaster()

    const toast = useToast()
    toast.info('First')
    toast.warning('Second')
    await nextTick()

    await user.keyboard('{Escape}')

    expect(
      screen.getAllByTestId('toast').map((element) => element.textContent)
    ).toEqual(['First', 'Second'])
  })

  it('does not prevent the default Escape behavior', async () => {
    renderToaster()

    useToast().info('Ready')
    await nextTick()

    const event = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Escape'
    })
    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
  })

  it('still closes from its button after an Escape handled elsewhere', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderToaster()
    useToast().warning('Check settings')
    await nextTick()

    pressEscapePreventedUpstream()
    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(useToast().toasts).toEqual([])
  })

  it('still times out after an Escape handled elsewhere', async () => {
    renderToaster()
    useToast().info('Uploaded', { duration: 1000 })
    await nextTick()

    pressEscapePreventedUpstream()
    await vi.advanceTimersByTimeAsync(1000)
    await nextTick()

    expect(useToast().toasts).toEqual([])
  })

  it('dismisses a notification from its close button', async () => {
    const user = userEvent.setup()
    renderToaster()

    useToast().warning('Check settings')
    await nextTick()
    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByText('Check settings')).not.toBeInTheDocument()
  })

  it('cannot swipe away a notification and keeps its text selectable', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderToaster()
    useToast().error('Sticky', { closable: false })
    await nextTick()
    const notification = screen.getByTestId('toast')
    notification.setPointerCapture = vi.fn()
    notification.releasePointerCapture = vi.fn()
    notification.hasPointerCapture = () => false

    await user.pointer([
      { coords: { x: 0, y: 0 }, keys: '[MouseLeft>]', target: notification },
      { coords: { x: 10, y: 0 } },
      { coords: { x: 80, y: 0 } },
      { keys: '[/MouseLeft]' }
    ])
    await nextTick()

    expect(screen.getByTestId('toast')).toHaveTextContent('Sticky')
    expect(screen.getByTestId('toast').style.userSelect).not.toBe('none')
  })
})
