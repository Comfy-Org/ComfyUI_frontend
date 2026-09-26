import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import HeroSection from './HeroSection.vue'

describe('HeroSection', () => {
  it.for([
    { locale: 'en', title: 'Built, Tweaked, and Dreamed in ComfyUI' },
    { locale: 'zh-CN', title: '在 ComfyUI 中构建、调整与创想' }
  ] as const)(
    'names the brand once in the $locale title',
    ({ locale, title }) => {
      render(HeroSection, { props: { locale } })

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        new RegExp(`^${title}$`),
        { normalizeWhitespace: false }
      )
    }
  )
})
