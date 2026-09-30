import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/site'
import HeroSection from './HeroSection.vue'

describe('HeroSection', () => {
  it('presents the platform hero heading and subtitle', () => {
    render(HeroSection, { props: { locale: 'en' } })

    expect(
      screen.getByRole('heading', {
        name: t('platform.hero.heading', {}, { locale: 'en' })
      })
    ).toBeTruthy()
    expect(screen.getByText(/fastest way from ComfyUI workflow/)).toBeTruthy()
  })
})
