import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import { routerT } from './routerCopy'
import ModelsApiHero from './ModelsApiHero.vue'

describe('ModelsApiHero', () => {
  it('presents the Comfy Router title, beta badge, and code tabs', () => {
    render(ModelsApiHero, { props: { locale: 'en' } })

    expect(screen.getByText('ROUTER', { exact: true })).toBeTruthy()
    expect(screen.queryByText('Comfy Router', { exact: true })).toBeNull()
    expect(
      screen.getByRole('heading', {
        name: t('platform.modelsHero.heading', 'en')
      })
    ).toBeTruthy()
    expect(
      screen.getByText(/Integrate frontier image, video, 3D and audio/)
    ).toBeTruthy()
    for (const panel of screen.getAllByRole('tabpanel'))
      expect(panel).toHaveTextContent('client.models.run')
    expect(
      screen.getAllByText(t('nav.badgeBeta', 'en')).length
    ).toBeGreaterThan(0)
    const browseModels = screen.getAllByRole('link', {
      name: routerT('platform.router.cta.browseModels', 'en')
    })
    expect(browseModels.length).toBeGreaterThan(0)
    for (const link of browseModels)
      expect(link.getAttribute('href')).toBe('/models')
  })

  it('sends the get-key link as a Router onboarding arrival', () => {
    render(ModelsApiHero, { props: { locale: 'en' } })

    expect(
      screen
        .getByRole('link', {
          name: routerT('platform.router.cta.getApiKey', 'en')
        })
        .getAttribute('href')
    ).toBe('https://platform.comfy.org/profile/api-keys?onboarding=router')
  })
})
