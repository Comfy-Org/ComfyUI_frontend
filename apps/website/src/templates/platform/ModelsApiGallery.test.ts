// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { t } from '../../i18n/translations'
import ModelsApiGallery from './ModelsApiGallery.vue'

describe('ModelsApiGallery', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
  })

  it('presents a card for each partner model and rotates its clips', async () => {
    render(ModelsApiGallery, { props: { locale: 'en' } })

    for (const titleKey of [
      'cloud.aiModels.card.seedance25',
      'cloud.aiModels.card.minimaxH3',
      'cloud.aiModels.card.nanoBananaPro',
      'cloud.aiModels.card.gptImage2'
    ] as const) {
      expect(screen.getByText(t(titleKey, 'en'))).toBeTruthy()
    }

    const seedanceClip = () =>
      screen
        .getByLabelText(t('cloud.aiModels.card.seedance25', 'en'))
        .getAttribute('src')
    const firstClip = seedanceClip()
    await vi.advanceTimersByTimeAsync(6000)
    await nextTick()
    expect(seedanceClip()).not.toBe(firstClip)
  })
})
