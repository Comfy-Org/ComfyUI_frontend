// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { addToast, removeAllToasts } from '../../config/auth-toast-state'
import AuthToast from './AuthToast.vue'

beforeEach(removeAllToasts)

describe('AuthToast', () => {
  it('shows a message raised before the host mounted', () => {
    addToast({ severity: 'error', summary: 'Error', detail: 'Too early' })

    render(AuthToast)

    expect(screen.getByRole('alert').textContent).toContain('Too early')
  })

  it('dismisses a message with a life only once that many milliseconds pass', async () => {
    render(AuthToast)
    addToast({
      severity: 'success',
      summary: 'Signed out',
      detail: 'Bye',
      life: 5000
    })
    await screen.findByRole('alert')

    await vi.advanceTimersByTimeAsync(4999)
    expect(screen.getByRole('alert')).toBeTruthy()

    await vi.advanceTimersByTimeAsync(1)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('keeps a message without a life until it is closed', async () => {
    render(AuthToast)
    addToast({ severity: 'error', summary: 'Error', detail: 'Sticky' })
    await screen.findByRole('alert')

    await vi.advanceTimersByTimeAsync(60_000)
    expect(screen.getByRole('alert')).toBeTruthy()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('closing early cancels the pending auto-dismiss', async () => {
    render(AuthToast)
    addToast({ severity: 'success', summary: 'Ok', detail: 'a', life: 5000 })
    await screen.findByRole('alert')

    await userEvent.setup().click(screen.getByRole('button', { name: 'Close' }))
    addToast({ severity: 'success', summary: 'Ok', detail: 'b' })
    await screen.findByRole('alert')
    await vi.advanceTimersByTimeAsync(5000)

    expect(
      screen.getByRole('alert').textContent,
      'the first message timer must not remove whatever is showing later'
    ).toContain('b')
  })

  it.for(['success', 'warn', 'error', 'info'] as const)(
    'announces the %s severity so styling and assistive tech can tell them apart',
    async (severity) => {
      render(AuthToast)
      addToast({ severity, summary: 'S', detail: 'D' })
      const alert = await screen.findByRole('alert')

      expect(alert.getAttribute('data-severity')).toBe(severity)
    }
  )

  it('announces assertively and atomically like PrimeVue', async () => {
    render(AuthToast)
    addToast({ severity: 'error', summary: 'S', detail: 'D' })
    const alert = await screen.findByRole('alert')

    expect(alert.getAttribute('aria-live')).toBe('assertive')
    expect(alert.getAttribute('aria-atomic')).toBe('true')
  })
})
