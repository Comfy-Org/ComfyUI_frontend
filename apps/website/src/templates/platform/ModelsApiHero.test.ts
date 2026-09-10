// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import ModelsApiHero from './ModelsApiHero.vue'

describe('ModelsApiHero', () => {
  it('presents the Comfy Router headline and both CTAs', () => {
    render(ModelsApiHero, { props: { locale: 'en' } })

    expect(
      screen.getByRole('heading', {
        name: t('platform.modelsHero.heading', 'en')
      })
    ).toBeTruthy()
    expect(
      screen.getByText(t('platform.router.hero.eyebrow', 'en'))
    ).toBeTruthy()
    expect(
      screen.getByRole('link', {
        name: t('platform.router.hero.primaryCta', 'en')
      })
    ).toBeTruthy()
    expect(
      screen.getByRole('link', {
        name: t('platform.router.hero.secondaryCta', 'en')
      })
    ).toBeTruthy()
  })
})
