import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { i18n } from '@/i18n'
import type { AgentFreeUsePlacement } from '@/platform/telemetry/types'

import FreeUseNotice from './FreeUseNotice.vue'
import { freeUseNoticeDismissedKey } from './freeUseNoticeDismissal'

vi.mock(import('@/composables/auth/useCurrentUser'))

function signIn(id: string) {
  vi.mocked(useCurrentUser).mockReturnValue({
    ...useCurrentUser(),
    resolvedUserInfo: computed(() => ({ id }))
  })
}

/**
 * `Learn more` is a real `target="_blank"` anchor, and happy-dom honours the
 * click by navigating a detached frame to the live docs page with its own
 * fetcher — so `vitest.network.setup.ts`, which guards `globalThis.fetch`, and
 * a `window.open` spy, which happy-dom's anchor handler does not call, both
 * miss it. Cancelling the default action is what stops the request; the click
 * still propagates, so the component's own handler runs.
 */
function withoutNavigation() {
  const cancel = (event: Event) => event.preventDefault()
  document.addEventListener('click', cancel, { capture: true })
  onTestFinished(() =>
    document.removeEventListener('click', cancel, { capture: true })
  )
}

function mount(placement: AgentFreeUsePlacement = 'top-banner') {
  return render(FreeUseNotice, {
    props: { placement },
    global: { plugins: [i18n] }
  })
}

describe('FreeUseNotice', () => {
  it('carries the bounded copy and an explainer link', () => {
    mount()

    expect(screen.getByRole('note')).toHaveTextContent(
      'Try your first chat for free!'
    )
    const link = screen.getByRole('link', { name: 'Learn more' })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute(
      'href',
      'https://docs.comfy.org/agent-tools/in-app-agent'
    )
  })

  it('reports a learn-more click', async () => {
    withoutNavigation()
    const { emitted } = mount()

    await userEvent.click(screen.getByRole('link', { name: 'Learn more' }))

    expect(emitted('notice')).toEqual([
      [{ action: 'shown', placement: 'top-banner' }],
      [{ action: 'learn_more_clicked', placement: 'top-banner' }]
    ])
  })

  it('hides itself and stays dismissed across a remount', async () => {
    const first = mount()

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(screen.queryByRole('note')).toBeNull()
    expect(first.emitted('notice')).toEqual([
      [{ action: 'shown', placement: 'top-banner' }],
      [{ action: 'dismissed', placement: 'top-banner' }]
    ])
    first.unmount()

    const { emitted } = mount('inside-input')

    expect(screen.queryByRole('note')).toBeNull()
    expect(emitted('notice')).toBeUndefined()
  })

  // A browser-wide dismissal would hide a treatment arm's notice from the next
  // account on a shared browser or after a switch, while the panel still
  // reports that viewer exposed to the arm.
  it('keeps a dismissal to the account that made it', async () => {
    signIn('first-user')
    const first = mount()
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    first.unmount()

    signIn('second-user')
    const { emitted } = mount()

    expect(screen.getByRole('note')).toBeInTheDocument()
    expect(emitted('notice')).toEqual([
      [{ action: 'shown', placement: 'top-banner' }]
    ])
  })

  // The dismissal key is account-scoped, so until auth settles the component is
  // reading the signed-out key. Both halves matter, and each would pass the
  // other's assertions: rendering before auth settles flashes the notice at
  // someone who had dismissed it, while reading auth readiness once at mount
  // hides it from every viewer whose account resolves later.
  it('renders after auth settles, for a late user who had not dismissed it', async () => {
    const authInitialized = ref(false)
    const userId = ref<string | null>(null)
    vi.mocked(useCurrentUser).mockReturnValue({
      ...useCurrentUser(),
      isAuthInitialized: computed(() => authInitialized.value),
      resolvedUserInfo: computed(() =>
        userId.value === null ? null : { id: userId.value }
      )
    })
    localStorage.setItem(freeUseNoticeDismissedKey('dismissed-user'), 'true')

    const { emitted } = mount()

    expect(screen.queryByRole('note')).toBeNull()
    expect(emitted('notice')).toBeUndefined()
    expect(
      localStorage.getItem(freeUseNoticeDismissedKey(undefined)),
      'no default planted under the signed-out key on the way to the real one'
    ).toBeNull()

    userId.value = 'dismissed-user'
    authInitialized.value = true
    await nextTick()

    expect(screen.queryByRole('note')).toBeNull()
    expect(emitted('notice')).toBeUndefined()

    // The notice appearing for an account that never dismissed it is the
    // post-auth signal this case needs: without it, the absence asserted above
    // is also what a gate that stopped re-reading after mount would produce.
    userId.value = 'fresh-user'

    expect(await screen.findByRole('note')).toBeInTheDocument()
    expect(emitted('notice')).toEqual([
      [{ action: 'shown', placement: 'top-banner' }]
    ])
  })
})
