import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { CardWorkflowItem } from './CardWorkflow01.vue'
import CardWorkflow01 from './CardWorkflow01.vue'

const item: CardWorkflowItem = {
  id: 'studio',
  title: 'Cinematic Studio',
  href: '/hub/apps/cinematic-studio/',
  media: { type: 'image', src: '/studio.png', alt: '' }
}

describe('CardWorkflow01', () => {
  it.for([
    { newTab: undefined, target: '_blank', rel: 'noopener noreferrer' },
    { newTab: true, target: '_blank', rel: 'noopener noreferrer' },
    { newTab: false, target: null, rel: null }
  ])(
    'sets target $target and rel $rel when newTab is $newTab',
    ({ newTab, target, rel }) => {
      render(CardWorkflow01, { props: { item: { ...item, newTab } } })

      const link = screen.getByRole('link', { name: 'Cinematic Studio' })
      expect(link).toHaveAttribute('href', item.href)
      expect(link.getAttribute('target')).toBe(target)
      expect(link.getAttribute('rel')).toBe(rel)
    }
  )

  it('renders no link without an href', () => {
    render(CardWorkflow01, { props: { item: { ...item, href: undefined } } })

    expect(screen.queryByRole('link')).toBeNull()
  })
})
