import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { vRekaZIndex } from '@/components/dialog/vRekaZIndex'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'

import Toaster from './Toaster.vue'
import { useToast } from './toastStore'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { close: 'Close' },
      notifications: {
        label: 'Notification',
        viewportLabel: 'Notifications ({hotkey})'
      }
    }
  }
})

describe('Toaster', () => {
  function renderToaster() {
    return render(Toaster, { global: { plugins: [i18n] } })
  }

  it('announces errors and warnings assertively and other notifications politely', async () => {
    renderToaster()
    const toast = useToast()

    toast.success('Saved')
    toast.loading('Uploading')
    toast.error('Could not save', { description: 'Disk is full' })
    toast.warning('Check settings')
    await nextTick()

    expect(
      screen.getByRole('status', { name: 'Notification' })
    ).toHaveTextContent('SavedUploading')
    expect(
      screen.getByRole('alert', { name: 'Notification' })
    ).toHaveTextContent('Could not save. Disk is fullCheck settings')
  })

  it('announces custom notifications by their text', async () => {
    renderToaster()

    useToast().custom({ template: '<div>Invite accepted</div>' }, {})
    await nextTick()

    expect(
      screen.getByRole('status', { name: 'Notification' })
    ).toHaveTextContent('Invite accepted')
  })

  it('keeps visible notifications out of the live regions', async () => {
    vi.useFakeTimers()
    renderToaster()

    useToast().error('Save failed', { description: 'Try another location' })
    await nextTick()
    await vi.advanceTimersByTimeAsync(1000)

    const notification = screen.getByTestId('toast')
    expect(notification).toHaveAttribute('aria-live', 'off')
    expect(notification).toHaveTextContent('Save failedTry another location')
    expect(
      screen.getAllByRole('alert').map((element) => element.textContent)
    ).not.toContainEqual(expect.stringContaining('[]'))
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
                notifications: {
                  label: 'Notification FR',
                  viewportLabel: 'Notifications FR ({hotkey})'
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

  it('automatically dismisses a timed notification', async () => {
    vi.useFakeTimers()
    renderToaster()

    useToast().info('Uploaded', { duration: 1000 })
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
      key: 'Escape',
      bubbles: true,
      cancelable: true
    })
    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
  })

  it('dismisses a notification from its close button', async () => {
    const user = userEvent.setup()
    renderToaster()

    useToast().warning('Check settings')
    await nextTick()
    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByText('Check settings')).not.toBeInTheDocument()
  })

  it('renders docked toasts outside the notification stack', async () => {
    renderToaster()

    useToast().custom(
      { template: '<div>Downloading models</div>' },
      {},
      { placement: 'dock' }
    )
    await nextTick()

    expect(screen.getByText('Downloading models')).toBeInTheDocument()
    expect(
      within(screen.getByTestId('toast-viewport')).queryByText(
        'Downloading models'
      )
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument()
  })

  it('keeps docked panels visible during node selection', async () => {
    renderToaster()
    useAgentNodeSelectionStore().isActive = true

    useToast().custom(
      { template: '<div>Downloading models</div>' },
      {},
      { placement: 'dock' }
    )
    await nextTick()

    expect(screen.getByText('Downloading models')).toBeVisible()
  })
})
