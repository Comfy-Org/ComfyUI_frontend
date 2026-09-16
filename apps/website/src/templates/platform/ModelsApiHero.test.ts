import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
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
    expect(
      screen.getAllByText('client.models.run', { exact: false }).length
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText(t('nav.badgeBeta', 'en')).length
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByRole('link', {
        name: t('platform.router.cta.browseModels', 'en')
      }).length
    ).toBeGreaterThan(0)
  })
})
