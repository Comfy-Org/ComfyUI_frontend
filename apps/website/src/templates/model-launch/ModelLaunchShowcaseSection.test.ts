import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { ModelLaunchShowcase } from './types'

import { t } from '../../i18n/translations'
import ModelLaunchShowcaseSection from './ModelLaunchShowcaseSection.vue'

const showcase: ModelLaunchShowcase = {
  eyebrowKey: 'nanoBanana.showcase.photography.eyebrow',
  headingKey: 'nanoBanana.showcase.photography.heading',
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
  it('labels the strip with its eyebrow and heading', () => {
    render(ModelLaunchShowcaseSection, { props: { showcase } })

    expect(screen.getByText('Photography')).toBeTruthy()
    expect(
      screen.getByRole('heading', { level: 2, name: 'Shot like it happened.' })
    ).toBeTruthy()
  })

  it.for([
    { descriptionKey: undefined, shown: false },
    { descriptionKey: 'chatgptImage25.hero.description', shown: true }
  ] as const)(
    'renders a description only when the page supplies one ($shown)',
    ({ descriptionKey, shown }) => {
      render(ModelLaunchShowcaseSection, {
        props: { showcase: { ...showcase, descriptionKey } }
      })

      expect(
        screen.queryByText(t('chatgptImage25.hero.description', 'en')) !== null
      ).toBe(shown)
    }
  )

  it('renders each still once with its localized alt text', () => {
    render(ModelLaunchShowcaseSection, { props: { showcase, locale: 'zh-CN' } })

    expect(
      screen.getAllByRole('img').map((img) => img.getAttribute('alt'))
    ).toEqual(['第一张', '第二张'])
  })
})
