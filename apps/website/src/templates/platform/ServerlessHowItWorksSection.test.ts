// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import ServerlessHowItWorksSection from './ServerlessHowItWorksSection.vue'

describe('ServerlessHowItWorksSection', () => {
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
})
