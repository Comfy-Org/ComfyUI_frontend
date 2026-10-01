import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { ModelLaunchShowcase } from './types'

import ModelLaunchShowcaseSection from './ModelLaunchShowcaseSection.vue'

const showcase: ModelLaunchShowcase = {
  headingAccentKey: 'nanoBanana.showcase.headingAccent',
  headingKey: 'nanoBanana.showcase.heading',
  descriptionKey: 'nanoBanana.showcase.description',
  cards: [
    {
      id: 'one',
      alt: { en: 'First still', 'zh-CN': '第一张' },
      src: 'https://media.comfy.org/one.webp'
    },
    {
      id: 'two',
      alt: { en: 'Second still', 'zh-CN': '第二张' },
      src: 'https://media.comfy.org/two.webp'
    }
  ]
}

describe('ModelLaunchShowcaseSection', () => {
  it('renders the accent and the rest of the heading as one heading', () => {
    render(ModelLaunchShowcaseSection, { props: { showcase } })

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Style applied in seconds.'
      })
    ).toBeTruthy()
  })

  it('exposes each still once and hides the looping copy from assistive tech', () => {
    render(ModelLaunchShowcaseSection, { props: { showcase, locale: 'zh-CN' } })

    expect(
      screen.getAllByRole('img').map((img) => img.getAttribute('alt'))
    ).toEqual(['第一张', '第二张'])
    expect(screen.getAllByRole('img', { hidden: true })).toHaveLength(4)
  })
})
