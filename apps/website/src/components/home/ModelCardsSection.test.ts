// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ModelCardsSection from './ModelCardsSection.vue'

describe('ModelCardsSection', () => {
  it('renders the approved featured models in route order', () => {
    render(ModelCardsSection)

    const cards = screen.getAllByRole('link', {
      name: /MiniMax H3 Max|FLUX 3|Seedance 2.5|MiniMax H3/
    })

    expect(cards.map((card) => card.getAttribute('href'))).toEqual([
      '/minimax-h3',
      '/flux-3',
      '/seedance-2.5',
      '/minimax-h3'
    ])
    expect(cards.map((card) => card.getAttribute('aria-label'))).toEqual([
      'MiniMax MiniMax H3 Max Text to Video',
      'Black Forest Labs FLUX 3 Image to Video',
      'ByteDance Seedance 2.5 Image to Video',
      'MiniMax MiniMax H3 Image to Video'
    ])
  })

  it('uses posters only for the model previews that have stable ones', () => {
    render(ModelCardsSection)

    const minimaxH3Max = screen.getByLabelText('MiniMax H3 Max preview')
    const seedance = screen.getByLabelText('Seedance 2.5 preview')
    const minimaxH3 = screen.getByLabelText('MiniMax H3 preview')

    expect(minimaxH3Max.getAttribute('src')).toBe(
      'https://media.comfy.org/website/minimax/fluid.webm'
    )
    expect(minimaxH3Max.getAttribute('poster')).toBe(
      'https://media.comfy.org/website/minimax/fluid-poster.webp'
    )
    expect(seedance.getAttribute('src')).toBe(
      'https://media.comfy.org/website/seedance-2.5/balloons.webm'
    )
    expect(seedance.getAttribute('poster')).toBe(
      'https://media.comfy.org/website/seedance-2.5/balloons-poster.webp'
    )
    expect(minimaxH3.getAttribute('src')).toBe(
      'https://media.comfy.org/website/minimax/ice-rider.webm'
    )
    expect(minimaxH3.getAttribute('poster')).toBe(
      'https://media.comfy.org/website/minimax/ice-rider-poster.webp'
    )
    expect(screen.queryByLabelText('FLUX 3 preview')).toBeNull()
  })

  it('updates the section, cards, and catalog CTA routes when locale changes', async () => {
    const { rerender } = render(ModelCardsSection)

    await rerender({ locale: 'zh-CN' })

    expect(screen.getByRole('region', { name: '精选模型' })).toBeTruthy()
    expect(
      screen
        .getByRole('link', {
          name: 'MiniMax MiniMax H3 Max 文本生成视频'
        })
        .getAttribute('href')
    ).toBe('/zh-CN/minimax-h3')
    expect(
      screen.getByRole('link', { name: '探索更多模型' }).getAttribute('href')
    ).toBe('/zh-CN/models')
  })
})
