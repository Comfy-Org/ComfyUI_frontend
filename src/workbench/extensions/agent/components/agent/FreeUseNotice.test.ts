import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

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

const PLACEMENTS = [
  'top-banner',
  'near-composer',
  'above-input',
  'inside-input'
] as const satisfies readonly AgentFreeUsePlacement[]

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

  it.for(PLACEMENTS)('carries the same copy at %s', (placement) => {
    mount(placement)

    expect(screen.getByRole('note')).toHaveTextContent(
      'Try your first chat for free!'
    )
    expect(screen.getByRole('link', { name: 'Learn more' })).toBeInTheDocument()
  })

  it('opens the explainer in a new tab rather than leaving the composer', () => {
    mount()

    const link = screen.getByRole('link', { name: 'Learn more' })
    expect(link).toHaveAttribute('target', '_blank')
    // The page the notice's own claim is explained on, not the general Cloud
    // introduction: a reader following this link has to be able to learn what
    // "a few free turns" means and what happens after them.
    expect(link).toHaveAttribute(
      'href',
      'https://docs.comfy.org/agent-tools/in-app-agent'
    )
  })

  it('reports a learn-more click', async () => {
    const { emitted } = mount()

    await userEvent.click(screen.getByRole('link', { name: 'Learn more' }))

    expect(emitted('notice')).toEqual([
      [{ action: 'shown', placement: 'top-banner' }],
      [{ action: 'learn_more_clicked', placement: 'top-banner' }]
    ])
  })

  it('hides itself and persists the dismissal', async () => {
    const { emitted } = mount()

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(screen.queryByRole('note')).toBeNull()
    expect(emitted('notice')).toEqual([
      [{ action: 'shown', placement: 'top-banner' }],
      [{ action: 'dismissed', placement: 'top-banner' }]
    ])
    expect(localStorage.getItem(freeUseNoticeDismissedKey(undefined))).toBe(
      'true'
    )
  })

  it('stays dismissed across placements, so an arm change cannot resurrect it', () => {
    localStorage.setItem(freeUseNoticeDismissedKey(undefined), 'true')
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
})
