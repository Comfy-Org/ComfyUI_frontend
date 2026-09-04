// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import ModelsApiGallery from './ModelsApiGallery.vue'

describe('ModelsApiGallery', () => {
  it('presents a card for each partner model', () => {
    render(ModelsApiGallery, { props: { locale: 'en' } })

    for (const titleKey of [
      'cloud.aiModels.card.seedance25',
      'cloud.aiModels.card.minimaxH3',
      'cloud.aiModels.card.nanoBananaPro',
      'cloud.aiModels.card.gptImage2'
    ] as const) {
      expect(screen.getByText(t(titleKey, 'en'))).toBeTruthy()
    }
  })
})
