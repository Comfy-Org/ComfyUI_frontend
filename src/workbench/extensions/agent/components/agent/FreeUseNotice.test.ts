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

  it('renders after auth settles, for a late user who had not dismissed it', async () => {
    const authInitialized = ref(false)
    const userId = ref<string | null>(null)
    vi.mocked(useCurrentUser).mockReturnValue({
      ...useCurrentUser(),
      isAuthInitialized: computed(() => authInitialized.value),
      isLoggedIn: computed(() => userId.value !== null),
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

    // Identity and the initialized verdict settle together: authStore reports
    // an authenticated user only once that user carries an id.
    userId.value = 'dismissed-user'
    authInitialized.value = true
    await nextTick()

    expect(screen.queryByRole('note')).toBeNull()
    expect(emitted('notice')).toBeUndefined()

    userId.value = 'fresh-user'

    expect(await screen.findByRole('note')).toBeInTheDocument()
    expect(emitted('notice')).toEqual([
      [{ action: 'shown', placement: 'top-banner' }]
    ])
  })
})
