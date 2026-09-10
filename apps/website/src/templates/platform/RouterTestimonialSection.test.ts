// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import RouterTestimonialSection from './RouterTestimonialSection.vue'

describe('RouterTestimonialSection', () => {
  it('presents the customer quote and attribution', () => {
    render(RouterTestimonialSection, { props: { locale: 'en' } })

    expect(
      screen.getByRole('heading', {
        name: t('platform.router.testimonial.header', 'en')
      })
    ).toBeTruthy()
    expect(
      screen.getByText(t('platform.router.testimonial.attribution', 'en'))
    ).toBeTruthy()
  })
})
