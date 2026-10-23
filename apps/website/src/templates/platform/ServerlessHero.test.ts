import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '@/i18n/translations'
import ServerlessHero from './ServerlessHero.vue'

describe('ServerlessHero', () => {
  it('presents the Comfy API title and CTAs', () => {
    render(ServerlessHero, { props: { locale: 'en' } })

    expect(
      screen.getByRole('heading', {
        name: t('platform.serverlessHero.heading', {}, { locale: 'en' })
      })
    ).toBeTruthy()
    expect(screen.getByText(/into an autoscaling endpoint/)).toBeTruthy()
    expect(
      screen.getByRole('link', {
        name: t('platform.hero.getStarted', {}, { locale: 'en' })
      })
    ).toHaveAttribute('href', 'https://platform.comfy.org/?onboarding=comfyapi')
    expect(
      screen.getByRole('link', {
        name: t('platform.hero.readDocs', {}, { locale: 'en' })
      })
    ).toHaveAttribute(
      'href',
      'https://docs.comfy.org/development/serverless/quickstart'
    )
    expect(
      screen.queryByText(t('nav.badgeBeta', {}, { locale: 'en' }))
    ).toBeNull()
  })

  it('loads the JSON API GPU animation after mounting', async () => {
    render(ServerlessHero, { props: { locale: 'en' } })

    const animation = await screen.findByTitle(
      t('platform.serverlessHero.animationTitle', {}, { locale: 'en' })
    )
    expect(animation).toHaveAttribute(
      'src',
      '/assets/platform/serverless/json-api-gpu-animation.html?v=astronaut-quality-2'
    )
  })
})
