import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { t } from '../../i18n/translations'
import ModelsApiGallery from './ModelsApiGallery.vue'
import type { ModelsGalleryCard } from './modelsGalleryCards'

describe('ModelsApiGallery', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
  })

  it('presents a card for each partner model and rotates its clips', async () => {
    render(ModelsApiGallery, { props: { locale: 'en' } })

    for (const titleKey of [
      'cloud.aiModels.card.seedance25',
      'cloud.aiModels.card.nanoBananaPro',
      'cloud.aiModels.card.chatgptImages25',
      'cloud.aiModels.card.klingAi30',
      'cloud.aiModels.card.flux3'
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

  it('links a card with a model id to its Models page', () => {
    render(ModelsApiGallery, { props: { locale: 'en' } })

    expect(
      screen.getByRole('link', {
        name: new RegExp(t('cloud.aiModels.card.seedance25', 'en'))
      })
    ).toHaveAttribute('href', '/models/byteplus--dreamina-seedance-2-5-260628/')
  })

  it('renders a card without a model id as a plain, non-linked div', () => {
    const cards: ModelsGalleryCard[] = [
      {
        titleKey: 'cloud.aiModels.card.seedance25',
        badgeIcon: '/icons/ai-models/bytedance.svg',
        media: [{ src: 'https://media.comfy.org/website/test.webp' }]
      }
    ]

    render(ModelsApiGallery, { props: { locale: 'en', cards } })

    expect(
      screen.queryByRole('link', {
        name: new RegExp(t('cloud.aiModels.card.seedance25', 'en'))
      })
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(t('cloud.aiModels.card.seedance25', 'en'))
    ).toBeTruthy()
  })
})
