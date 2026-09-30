import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { prefersReducedMotion } from '../../composables/useReducedMotion'
import { t } from '../../i18n/translations'
import {
  setAllIntersecting,
  stubIntersectionObserver
} from '../../test/fakeIntersectionObserver'
import TeamSharingChat from './TeamSharingChat.vue'

vi.mock(import('../../composables/useReducedMotion'), () => ({
  prefersReducedMotion: vi.fn(() => false)
}))

describe('TeamSharingChat', () => {
  beforeEach(() => {
    stubIntersectionObserver()
    vi.mocked(prefersReducedMotion).mockReturnValue(false)
  })

  it('advances messages while visible and keeps endpoints synchronized', async () => {
    vi.useFakeTimers()
    const { rerender, unmount } = render(TeamSharingChat, {
      props: { endpoint: 'first-workflow', locale: 'en' }
    })

    await setAllIntersecting(true)
    await vi.advanceTimersByTimeAsync(3200)

    expect(
      screen.getByText(t('platform.howItWorks.chat.message', 'en'))
    ).toBeTruthy()

    await rerender({ endpoint: 'second-workflow', locale: 'en' })

    expect(screen.queryByText('first-workflow.run.comfy.app')).toBeNull()
    expect(screen.getAllByText('second-workflow.run.comfy.app')).toHaveLength(2)

    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('shows a fixed sequence when reduced motion is preferred', async () => {
    vi.useFakeTimers()
    vi.mocked(prefersReducedMotion).mockReturnValue(true)
    const { unmount } = render(TeamSharingChat, {
      props: { endpoint: 'steady-workflow', locale: 'en' }
    })

    await setAllIntersecting(true)
    await vi.advanceTimersByTimeAsync(6400)

    expect(
      screen.queryByText(t('platform.howItWorks.chat.message', 'en'))
    ).toBeNull()
    expect(
      screen.getByText(t('platform.howItWorks.chat.messageReady', 'en'))
    ).toBeTruthy()
    expect(
      screen.getByText(t('platform.howItWorks.chat.messagePreview', 'en'))
    ).toBeTruthy()

    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
