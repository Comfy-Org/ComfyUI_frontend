// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import WhatsNextSection from './WhatsNextSection.vue'

const props = {
  title: 'How Moment Factory reimagined projection mapping',
  image: 'https://media.comfy.org/website/customers/moment-factory/cover.webp',
  href: '/customers/moment-factory'
}

describe('WhatsNextSection', () => {
  it('defaults the CTA to VIEW ARTICLE for written-story callers', () => {
    render(WhatsNextSection, { props })

    expect(screen.getByRole('link', { name: /VIEW ARTICLE/ })).toHaveProperty(
      'href',
      expect.stringContaining(props.href)
    )
  })

  it('uses a custom CTA label when one is given', () => {
    render(WhatsNextSection, { props: { ...props, ctaLabel: 'WATCH STORY' } })

    expect(screen.getByRole('link', { name: /WATCH STORY/ })).toBeTruthy()
    expect(screen.queryByText('VIEW ARTICLE')).toBeNull()
  })
})
