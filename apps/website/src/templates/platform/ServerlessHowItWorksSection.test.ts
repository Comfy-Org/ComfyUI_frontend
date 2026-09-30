/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { t } from '../../i18n/site'
import {
  setAllIntersecting,
  stubIntersectionObserver
} from '../../test/fakeIntersectionObserver'
import ServerlessHowItWorksSection from './ServerlessHowItWorksSection.vue'

describe('ServerlessHowItWorksSection', () => {
  let visibilityState: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    stubIntersectionObserver()
    visibilityState = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('visible')
  })

  it('presents three unnumbered cards from workflow JSON to applications', () => {
    render(ServerlessHowItWorksSection, { props: { locale: 'en' } })

    expect(
      screen.getByRole('heading', {
        name: t('platform.serverlessDeploy.heading', {}, { locale: 'en' })
      })
    ).toBeTruthy()
    expect(screen.getByRole('list')).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getAllByRole('article')).toHaveLength(3)
    expect(screen.queryByText('1')).toBeNull()
    expect(screen.queryByText('2')).toBeNull()
    expect(screen.queryByText('3')).toBeNull()
    for (const step of [1, 2, 3] as const) {
      expect(
        screen.getByText(
          t(`platform.howItWorks.${step}.title`, {}, { locale: 'en' })
        )
      ).toBeTruthy()
    }
  })

  it('localizes the step copy for zh-CN', () => {
    render(ServerlessHowItWorksSection, { props: { locale: 'zh-CN' } })

    expect(
      screen.getByText(
        t('platform.howItWorks.1.title', {}, { locale: 'zh-CN' })
      )
    ).toBeTruthy()
  })

  it('animates connectors only while the section and tab are visible', async () => {
    const { container } = render(ServerlessHowItWorksSection)

    await setAllIntersecting(true)
    expect(container.querySelectorAll('.animate-dash-flow')).toHaveLength(5)

    await setAllIntersecting(false)
    expect(container.querySelectorAll('.animate-dash-flow')).toHaveLength(0)

    await setAllIntersecting(true)
    visibilityState.mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    await nextTick()
    expect(container.querySelectorAll('.animate-dash-flow')).toHaveLength(0)
  })

  it('rotates the workflow in sync and pauses changes offscreen', async () => {
    vi.useFakeTimers()
    const { unmount } = render(ServerlessHowItWorksSection)
    await setAllIntersecting(true)

    expect(screen.getAllByText('try-on-x7k2')).toHaveLength(2)

    await vi.advanceTimersByTimeAsync(5000)
    expect(screen.getAllByText('product-photos')).toHaveLength(2)

    await setAllIntersecting(false)
    await vi.advanceTimersByTimeAsync(15000)
    expect(screen.getAllByText('product-photos')).toHaveLength(2)

    await setAllIntersecting(true)
    await vi.advanceTimersByTimeAsync(5000)
    expect(screen.getAllByText('upscale-4k')).toHaveLength(2)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(15000)
    expect(vi.getTimerCount()).toBe(0)
  })
})
