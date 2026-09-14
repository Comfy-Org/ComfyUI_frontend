// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import { onBeforeSignInLeave } from '../../config/workshop-return'
import HeaderAccount from './HeaderAccount.vue'

const h = vi.hoisted(() => ({
  flag: undefined as { value: boolean } | undefined,
  user: undefined as { value: unknown } | undefined,
  session: undefined as { value: unknown } | undefined,
  sessionFailure: undefined as { value: unknown } | undefined,
  balance: undefined as { value: unknown } | undefined,
  ensureFresh: vi.fn(),
  remint: vi.fn(),
  signOut: vi.fn()
}))

vi.mock<unknown>(import('../../scripts/posthog'), async () => {
  const { ref } = await import('vue')
  const flag = ref(true)
  h.flag = flag
  return { useWorkshopAuthFlag: () => flag }
})

vi.mock<unknown>(import('../../config/workshop-session-state'), async () => {
  const { ref } = await import('vue')
  const user = ref<unknown>(null)
  const session = ref<unknown>(undefined)
  const sessionFailure = ref<unknown>(undefined)
  h.user = user
  h.session = session
  h.sessionFailure = sessionFailure
  return {
    useWorkshopSession: () => ({
      user,
      session,
      sessionFailure,
      ensureFresh: h.ensureFresh,
      remint: h.remint,
      signOut: h.signOut
    })
  }
})

vi.mock<unknown>(import('../../config/workshop-credits'), async () => {
  const { ref } = await import('vue')
  const balance = ref<unknown>({ status: 'unknown' })
  h.balance = balance
  const { computed } = await import('vue')
  return {
    useWorkshopCredits: () => ({ balance }),
    refreshWorkshopCredits: vi.fn().mockResolvedValue(undefined),
    watchForTopUp: vi.fn(),
    clearTopUpWatch: vi.fn(),
    useTopUpWatch: () => computed(() => ({ status: 'idle' }))
  }
})

beforeEach(() => {
  h.remint.mockReset()
  h.flag!.value = true
  h.user!.value = null
  h.session!.value = undefined
  h.sessionFailure!.value = undefined
  h.balance!.value = { status: 'unknown' }
  h.ensureFresh.mockReset().mockResolvedValue({ status: 'error' })
  h.signOut.mockReset().mockResolvedValue(undefined)
})

describe('HeaderAccount sign-in link', () => {
  it('runs the registered stashes before leaving for sign-in', async () => {
    const assign = vi.fn()
    vi.spyOn(window.location, 'assign').mockImplementation(assign)
    const stash = vi.fn()
    const stop = onBeforeSignInLeave(stash)
    onTestFinished(stop)
    render(HeaderAccount)

    await userEvent
      .setup()
      .click(screen.getByRole('link', { name: /sign in/i }))

    expect(stash.mock.invocationCallOrder[0]).toBeLessThan(
      assign.mock.invocationCallOrder[0]
    )
  })

  it('waits for an asynchronous file stash before navigating', async () => {
    const assign = vi.fn()
    vi.spyOn(window.location, 'assign').mockImplementation(assign)
    const saved = Promise.withResolvers<void>()
    const stop = onBeforeSignInLeave(() => saved.promise)
    onTestFinished(stop)
    render(HeaderAccount)

    await userEvent
      .setup()
      .click(screen.getByRole('link', { name: /sign in/i }))

    expect(assign).not.toHaveBeenCalled()
    saved.resolve()
    await vi.waitFor(() => expect(assign).toHaveBeenCalledOnce())
  })

  it('does not redirect a departed page after its file stash settles', async () => {
    const assign = vi.fn()
    vi.spyOn(window.location, 'assign').mockImplementation(assign)
    const saved = Promise.withResolvers<void>()
    const stop = onBeforeSignInLeave(() => saved.promise)
    onTestFinished(stop)
    render(HeaderAccount)

    await userEvent
      .setup()
      .click(screen.getByRole('link', { name: /sign in/i }))
    window.dispatchEvent(new Event('pagehide'))
    saved.resolve()
    await saved.promise
    await Promise.resolve()

    expect(assign).not.toHaveBeenCalled()
  })

  it('sends the visitor to sign in with the current page as the return destination', async () => {
    const assign = vi.fn()
    vi.spyOn(window.location, 'assign').mockImplementation(assign)
    window.history.replaceState({}, '', '/workshop/models/example/?tab=api')
    render(HeaderAccount)

    await userEvent
      .setup()
      .click(screen.getByRole('link', { name: /sign in/i }))

    expect(assign).toHaveBeenCalledWith(
      '/login/?returnTo=%2Fworkshop%2Fmodels%2Fexample%2F%3Ftab%3Dapi'
    )
  })

  it('leaves a modified click to the browser with the return destination already on the link', async () => {
    const assign = vi.fn()
    vi.spyOn(window.location, 'assign').mockImplementation(assign)
    window.history.replaceState({}, '', '/workshop/models/example/?tab=api')
    render(HeaderAccount)

    const link = screen.getByRole('link', { name: /sign in/i })
    expect(
      link.getAttribute('href'),
      'the first render must match the server output'
    ).toBe('/login/')

    await fireEvent(link, new Event('pointerdown', { bubbles: true }))
    link.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        metaKey: true
      })
    )

    expect(assign).not.toHaveBeenCalled()
    expect(
      link.getAttribute('href'),
      'open-in-new-tab must land on the model page after sign-in, not the Workshop home'
    ).toBe('/login/?returnTo=%2Fworkshop%2Fmodels%2Fexample%2F%3Ftab%3Dapi')
  })

  it('stashes unsaved work even when a modified click opens sign-in in a new tab', async () => {
    const stash = vi.fn()
    const stop = onBeforeSignInLeave(stash)
    onTestFinished(stop)
    render(HeaderAccount)

    const link = screen.getByRole('link', { name: /sign in/i })
    await fireEvent(link, new Event('pointerdown', { bubbles: true }))
    const notPrevented = link.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        metaKey: true
      })
    )

    expect(
      stash,
      'a new tab must carry the latest form, so the stash runs even when the click is not the primary navigation'
    ).toHaveBeenCalledOnce()
    expect(
      notPrevented,
      'the modified click must reach the browser, so its default new-tab navigation is never prevented'
    ).toBe(true)
  })

  it('prepares the destination on focus, so a keyboard open-in-new-tab keeps it too', async () => {
    window.history.replaceState({}, '', '/workshop/models/example/')
    render(HeaderAccount)
    const link = screen.getByRole('link', { name: /sign in/i })

    await fireEvent.focus(link)

    expect(link.getAttribute('href')).toBe(
      '/login/?returnTo=%2Fworkshop%2Fmodels%2Fexample%2F'
    )
  })
})
