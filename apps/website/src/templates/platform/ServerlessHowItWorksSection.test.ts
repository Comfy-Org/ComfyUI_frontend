// @vitest-environment happy-dom
/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { t } from '../../i18n/translations'
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
        name: t('platform.serverlessDeploy.heading', 'en')
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
        screen.getByText(t(`platform.howItWorks.${step}.title`, 'en'))
      ).toBeTruthy()
    }
  })

  it('localizes the step copy for zh-CN', () => {
    render(ServerlessHowItWorksSection, { props: { locale: 'zh-CN' } })

    expect(
      screen.getByText(t('platform.howItWorks.1.title', 'zh-CN'))
    ).toBeTruthy()
  })

  it('animates connectors only while the section and tab are visible', async () => {
    const { container } = render(ServerlessHowItWorksSection)

    await setAllIntersecting(true)
    expect(container.querySelectorAll('.animate-dash-flow')).toHaveLength(6)

    await setAllIntersecting(false)
    expect(container.querySelectorAll('.animate-dash-flow')).toHaveLength(0)

    await setAllIntersecting(true)
    visibilityState.mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    await nextTick()
    expect(container.querySelectorAll('.animate-dash-flow')).toHaveLength(0)
  })
})
