// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import ModelsApiHero from './ModelsApiHero.vue'

describe('ModelsApiHero', () => {
  it('presents the Models API title and code tabs', () => {
    render(ModelsApiHero, { props: { locale: 'en' } })

    expect(
      screen.getByRole('heading', {
        name: t('platform.modelsHero.heading', 'en')
      })
    ).toBeTruthy()
    expect(screen.getByText(/state-of-the-art models for image/)).toBeTruthy()
    expect(
      screen.getAllByText('comfy.models.run', { exact: false }).length
    ).toBeGreaterThan(0)
    expect(screen.queryByText(t('nav.badgeComingSoon', 'en'))).toBeNull()
    expect(screen.queryByText(t('nav.badgeBeta', 'en'))).toBeNull()
  })
})
