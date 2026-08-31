// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import ModelsApiFeaturesSection from './ModelsApiFeaturesSection.vue'

describe('ModelsApiFeaturesSection', () => {
  it('renders the supplied Models API value callouts', () => {
    render(ModelsApiFeaturesSection, { props: { locale: 'en' } })

    expect(
      screen.getByRole('heading', {
        name: t('platform.modelsFeatures.heading', 'en')
      })
    ).toBeTruthy()
    expect(screen.getAllByRole('article')).toHaveLength(6)
    expect(
      screen.getByText(t('platform.modelsFeatures.1.title', 'en'))
    ).toBeTruthy()
    expect(
      screen.getByText(t('platform.modelsFeatures.2.title', 'en'))
    ).toBeTruthy()
    expect(
      screen.getByText(t('platform.modelsFeatures.3.title', 'en'))
    ).toBeTruthy()
    expect(
      screen.getByText(t('platform.modelsFeatures.4.title', 'en'))
    ).toBeTruthy()
    expect(
      screen.getByText(t('platform.modelsFeatures.5.title', 'en'))
    ).toBeTruthy()
    expect(
      screen.getByText(t('platform.modelsFeatures.6.title', 'en'))
    ).toBeTruthy()
  })
})
