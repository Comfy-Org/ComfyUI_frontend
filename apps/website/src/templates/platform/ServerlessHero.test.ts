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
      screen.getByRole('link', { name: t('platform.hero.getStarted', 'en') })
    ).toHaveAttribute('href', 'https://platform.comfy.org/?onboarding=comfyapi')
    expect(
      screen.getByRole('link', { name: t('platform.hero.readDocs', 'en') })
    ).toHaveAttribute(
      'href',
      'https://docs.comfy.org/development/serverless/overview'
    )
    expect(screen.queryByText(t('nav.badgeBeta', 'en'))).toBeNull()
  })

  it('loads the JSON API GPU animation', () => {
    render(ServerlessHero, { props: { locale: 'en' } })

    const animation = screen.getByTitle(
      t('platform.serverlessHero.animationTitle', 'en')
    )
    expect(animation).toHaveAttribute(
      'src',
      '/assets/platform/serverless/json-api-gpu-animation.html'
    )
  })
})
