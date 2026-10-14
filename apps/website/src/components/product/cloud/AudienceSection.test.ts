import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import AudienceSection from './AudienceSection.vue'

describe('AudienceSection', () => {
  it.for([
    {
      locale: 'en',
      heading: 'Built for creators who need quality, control, and simplicity.',
      highlight: 'creators'
    },
    {
      locale: 'zh-CN',
      heading: '为追求质量、控制与简约的创作者而生。',
      highlight: '创作者'
    }
  ] as const)(
    'highlights the audience where the $locale heading places it',
    ({ locale, heading, highlight }) => {
      render(AudienceSection, { props: { locale } })

      const title = screen.getByRole('heading', { level: 2 })
      expect(title).toHaveTextContent(new RegExp(`^${heading}$`), {
        normalizeWhitespace: false
      })
      expect(within(title).getByText(highlight)).toHaveClass('text-white')
    }
  )
})
