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
    { newTab: undefined, target: '_blank' },
    { newTab: true, target: '_blank' },
    { newTab: false, target: null }
  ])('sets target $target when newTab is $newTab', ({ newTab, target }) => {
    render(CardWorkflow01, { props: { item: { ...item, newTab } } })

    const link = screen.getByRole('link', { name: 'Cinematic Studio' })
    expect(link).toHaveAttribute('href', item.href)
    expect(link.getAttribute('target')).toBe(target)
  })

  it('renders no link without an href', () => {
    render(CardWorkflow01, { props: { item: { ...item, href: undefined } } })

    expect(screen.queryByRole('link')).toBeNull()
  })
})
