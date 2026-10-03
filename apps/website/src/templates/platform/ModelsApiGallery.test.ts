import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { getRouterModelHref } from '../../config/workshop-router-content'
import { t } from '../../i18n/translations'
import ModelsApiGallery from './ModelsApiGallery.vue'
import type { ModelsGalleryCard } from './modelsGalleryCards'
import { modelsGalleryCards } from './modelsGalleryCards'

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
      expect(screen.getByText(t(titleKey, {}, { locale: 'en' }))).toBeTruthy()
    }

    const seedanceClip = () =>
      screen
        .getByLabelText(
          t('cloud.aiModels.card.seedance25', {}, { locale: 'en' })
        )
        .getAttribute('src')
    const firstClip = seedanceClip()
    await vi.advanceTimersByTimeAsync(6000)
    await nextTick()
    expect(seedanceClip()).not.toBe(firstClip)
  })

  it('links a card with a model id to its canonical Models page, not a redirecting short slug', () => {
    render(ModelsApiGallery, { props: { locale: 'en' } })

    expect(
      screen.getByRole('link', {
        name: new RegExp(
          t('cloud.aiModels.card.seedance25', {}, { locale: 'en' })
        )
      })
    ).toHaveAttribute('href', '/hub/models/seedance-2-5-text-to-video/')
  })

  it('links a model id shared by several use cases to the specific page the card names', () => {
    render(ModelsApiGallery, { props: { locale: 'en' } })

    expect(
      screen.getByRole('link', {
        name: new RegExp(
          t('cloud.aiModels.card.geminiOmniFlash', {}, { locale: 'en' })
        )
      })
    ).toHaveAttribute(
      'href',
      '/hub/models/gemini-omni-1-1-flash-image-to-video/'
    )
  })

  it('bakes in the href the Router catalogue resolves for each card, so the two never drift', () => {
    for (const card of modelsGalleryCards) {
      if (!card.modelId) continue
      expect(card.href).toBe(getRouterModelHref(card.modelId, card.useCase))
    }
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
        name: new RegExp(
          t('cloud.aiModels.card.seedance25', {}, { locale: 'en' })
        )
      })
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(
        t('cloud.aiModels.card.seedance25', {}, { locale: 'en' })
      )
    ).toBeTruthy()
  })
})
