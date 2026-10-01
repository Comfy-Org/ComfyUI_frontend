import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import ServerlessCustomerProofSection from './ServerlessCustomerProofSection.vue'

describe('ServerlessCustomerProofSection', () => {
  it('hides customer proof by default', () => {
    render(ServerlessCustomerProofSection, { props: { locale: 'en' } })

    expect(
      screen.queryByText(t('platform.serverlessCaseStudy.quote', 'en'))
    ).toBeNull()
  })

  it('shows creative apps and can reveal customer proof', () => {
    render(ServerlessCustomerProofSection, {
      props: { locale: 'en', showCustomerProof: true }
    })

    expect(
      screen.getByRole('heading', {
        name: t('platform.serverlessApps.heading', 'en')
      })
    ).toBeTruthy()
    expect(
      screen.getByLabelText(t('platform.serverlessApps.videoLabel', 'en'), {
        selector: 'video'
      })
    ).toBeTruthy()
    expect(
      screen.getByRole('link', {
        name: t('platform.serverlessApps.browseApps', 'en')
      })
    ).toHaveAttribute('href', '/hub/apps/')
    expect(
      screen.getByText(t('platform.serverlessCaseStudy.quote', 'en'))
    ).toBeTruthy()
    expect(
      screen.getByRole('link', {
        name: t('platform.serverlessCaseStudy.linkLabel', 'en')
      })
    ).toHaveAttribute('href', '/customers/svedka-silverside/')
  })
})
