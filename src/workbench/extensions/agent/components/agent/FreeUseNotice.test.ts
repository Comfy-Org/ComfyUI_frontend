import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { computed, ref } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { i18n } from '@/i18n'
import type { AgentFreeUsePlacement } from '@/platform/telemetry/types'

import FreeUseNotice from './FreeUseNotice.vue'
import { freeUseNoticeDismissedKey } from './freeUseNoticeDismissal'

vi.mock(import('@/composables/auth/useCurrentUser'))

function signIn(id: string | null, authInitialized = true) {
  vi.mocked(useCurrentUser).mockReturnValue({
    ...useCurrentUser(),
    isAuthInitialized: computed(() => authInitialized),
    resolvedUserInfo: computed(() => (id === null ? null : { id }))
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
  beforeEach(() => {
    localStorage.clear()
  })

  // The copy and the link do not vary by placement — only `PLACEMENT_CLASSES`
  // does — so one case covers them and the per-arm render is asserted in
  // AgentPanel.freeUsePlacement.test.ts.
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
    expect(localStorage.getItem(freeUseNoticeDismissedKey('first-user'))).toBe(
      'true'
    )
    first.unmount()

    signIn('second-user')
    const { emitted } = mount()

    expect(screen.getByRole('note')).toBeInTheDocument()
    expect(emitted('notice')).toEqual([
      [{ action: 'shown', placement: 'top-banner' }]
    ])
  })

  // The dismissal key is account-scoped, so until auth settles the component is
  // reading the signed-out key. Rendering then flashes the notice at a viewer
  // who had dismissed it and reports an impression they did not choose to see.
  it('waits for auth before rendering or reporting an impression', async () => {
    const authInitialized = ref(false)
    const userId = ref<string | null>(null)
    vi.mocked(useCurrentUser).mockReturnValue({
      ...useCurrentUser(),
      isAuthInitialized: computed(() => authInitialized.value),
      resolvedUserInfo: computed(() =>
        userId.value === null ? null : { id: userId.value }
      )
    })
    localStorage.setItem(freeUseNoticeDismissedKey('late-user'), 'true')

    const { emitted } = mount()

    expect(screen.queryByRole('note')).toBeNull()
    expect(emitted('notice')).toBeUndefined()
    // No default planted under the signed-out key on the way to the real one.
    expect(
      localStorage.getItem(freeUseNoticeDismissedKey(undefined))
    ).toBeNull()

    userId.value = 'late-user'
    authInitialized.value = true
    await vi.waitFor(() => expect(screen.queryByRole('note')).toBeNull())
    expect(emitted('notice')).toBeUndefined()
  })
})
