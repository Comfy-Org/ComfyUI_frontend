import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import ServerlessCustomerProofSection from './ServerlessCustomerProofSection.vue'

describe('ServerlessCustomerProofSection', () => {
  it('shows the Silverside customer quote while creative apps are hidden', () => {
    render(ServerlessCustomerProofSection, { props: { locale: 'en' } })

    expect(
      screen.getByText(t('platform.serverlessCaseStudy.quote', 'en'))
    ).toBeTruthy()
    expect(
      screen.getByRole('link', {
        name: t('platform.serverlessCaseStudy.linkLabel', 'en')
      })
    ).toHaveAttribute('href', '/customers/svedka-silverside')
    expect(
      screen.queryByRole('heading', {
        name: t('platform.serverlessApps.heading', 'en')
      })
    ).toBeNull()
  })

  it('can reveal the creative apps section without changing the testimonial', () => {
    render(ServerlessCustomerProofSection, {
      props: { locale: 'en', showCreativeApps: true }
    })

    expect(
      screen.getByRole('heading', {
        name: t('platform.serverlessApps.heading', 'en')
      })
    ).toBeTruthy()
    expect(
      screen.getByText(t('platform.serverlessCaseStudy.quote', 'en'))
    ).toBeTruthy()
  })
})
