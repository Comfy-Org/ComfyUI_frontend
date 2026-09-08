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
        name: t('platform.serverlessHero.heading', 'en')
      })
    ).toBeTruthy()
    expect(screen.getByText(/into an autoscaling endpoint/)).toBeTruthy()
    expect(
      screen.getAllByRole('link', { name: t('platform.hero.getStarted', 'en') })
        .length
    ).toBeGreaterThan(0)
    expect(screen.queryByText(t('nav.badgeBeta', 'en'))).toBeNull()
  })
})
