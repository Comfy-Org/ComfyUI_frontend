import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'
import type { AgentFreeUsePlacement } from '@/platform/telemetry/types'

import FreeUseNotice from './FreeUseNotice.vue'
import { FREE_USE_NOTICE_DISMISSED_KEY } from './freeUseNoticeDismissal'

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
      'Prompts and workflow runs are FREE during BETA.'
    )
    expect(screen.getByRole('link', { name: 'Learn more' })).toBeInTheDocument()
  })

  it('opens the explainer in a new tab rather than leaving the composer', () => {
    mount()

    const link = screen.getByRole('link', { name: 'Learn more' })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute(
      'href',
      'https://docs.comfy.org/get_started/cloud'
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
    expect(localStorage.getItem(FREE_USE_NOTICE_DISMISSED_KEY)).toBe('true')
  })

  it('stays dismissed across placements, so an arm change cannot resurrect it', () => {
    localStorage.setItem(FREE_USE_NOTICE_DISMISSED_KEY, 'true')
    const { emitted } = mount('inside-input')

    expect(screen.queryByRole('note')).toBeNull()
    expect(emitted('notice')).toBeUndefined()
  })
})
