import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { translationsFor } from '../../i18n/translations'
import ModelsApiHero from './ModelsApiHero.vue'

const { t } = translationsFor('en')

describe('ModelsApiHero', () => {
  it('presents the Comfy Router title and code tabs without a beta badge', () => {
    render(ModelsApiHero, { props: { locale: 'en' } })

    expect(screen.getByText('ROUTER', { exact: true })).toBeTruthy()
    expect(screen.queryByText('Comfy Router', { exact: true })).toBeNull()
    expect(
      screen.getByRole('heading', {
        name: t('platform.modelsHero.heading')
      })
    ).toBeTruthy()
    expect(
      screen.getByText(/Integrate frontier image, video, 3D and audio/)
    ).toBeTruthy()
    for (const panel of screen.getAllByRole('tabpanel'))
      expect(panel).toHaveTextContent('client.models.run')
    expect(screen.queryByText(t('nav.badgeBeta'))).toBeNull()
    const browseModels = screen.getAllByRole('link', {
      name: t('platform.router.cta.browseModels')
    })
    expect(browseModels.length).toBeGreaterThan(0)
    for (const link of browseModels)
      expect(link.getAttribute('href')).toBe('/hub/models/')
  })

  it('sends the get-key link as a Router onboarding arrival', () => {
    render(ModelsApiHero, { props: { locale: 'en' } })

    expect(
      screen
        .getByRole('link', {
          name: t('platform.modelsHero.getApiKey')
        })
        .getAttribute('href')
    ).toBe('https://platform.comfy.org/profile/api-keys?onboarding=router')
  })
})
