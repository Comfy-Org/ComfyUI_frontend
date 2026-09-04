// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import HeroSection from './HeroSection.vue'

describe('HeroSection', () => {
  it('presents the platform hero heading and subtitle', () => {
    render(HeroSection, { props: { locale: 'en' } })

    expect(
      screen.getByRole('heading', {
        name: t('platform.hero.heading', 'en')
      })
    ).toBeTruthy()
    expect(screen.getByText(/fastest way from ComfyUI workflow/)).toBeTruthy()
  })
})
