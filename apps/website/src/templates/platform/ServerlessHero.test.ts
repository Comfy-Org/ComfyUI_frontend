// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import ServerlessHero from './ServerlessHero.vue'

describe('ServerlessHero', () => {
  it('presents the Comfy API title and CTAs', () => {
    render(ServerlessHero, { props: { locale: 'en' } })

    expect(
      screen.getByRole('heading', {
        name: t('platform.products.serverless.title', 'en')
      })
    ).toBeTruthy()
    expect(
      screen.getAllByRole('link', { name: t('platform.hero.getStarted', 'en') })
        .length
    ).toBeGreaterThan(0)
  })
})
