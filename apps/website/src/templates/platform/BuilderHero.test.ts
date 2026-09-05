// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import BuilderHero from './BuilderHero.vue'

describe('BuilderHero', () => {
  it('presents the Builder title and description', () => {
    render(BuilderHero, { props: { locale: 'en' } })

    expect(
      screen.getByRole('heading', {
        name: t('platform.builderHero.heading', 'en')
      })
    ).toBeTruthy()
    expect(
      screen.getByText(t('platform.builderHero.subtitle', 'en'))
    ).toBeTruthy()
  })
})
