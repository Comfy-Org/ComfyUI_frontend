// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import ServerlessHowItWorksSection from './ServerlessHowItWorksSection.vue'

describe('ServerlessHowItWorksSection', () => {
  it('shows the packaging and deployment steps', () => {
    render(ServerlessHowItWorksSection, { props: { locale: 'en' } })

    expect(
      screen.getByRole('heading', {
        name: t('platform.serverlessDeploy.heading', 'en')
      })
    ).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(
      screen.getByText(t('platform.serverlessDeploy.2.title', 'en'))
    ).toBeTruthy()
    expect(
      screen.getByText(t('platform.serverlessDeploy.3.title', 'en'))
    ).toBeTruthy()
  })
})
