import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { CardView } from '../../lib/hub/catalogue-card'
import CatalogueCard from './CatalogueCard.vue'

const view = (overrides: Partial<CardView> = {}): CardView => ({
  kind: 'workflow',
  href: '/hub/workflow/eraser/',
  title: 'Remove an object',
  media: { url: 'still.webp', kind: 'image' },
  hoverMedia: 'over.webp',
  compare: true,
  maker: { label: 'ComfyUI', logo: undefined },
  mark: { label: 'Bria', logo: undefined },
  badges: ['Image'],
  reach: undefined,
  ...overrides
})

const mount = (overrides: Partial<CardView> = {}) =>
  render(CatalogueCard, { props: { view: view(overrides) } })

const seam = () => screen.getByTestId('catalogue-card-compare')

describe('CatalogueCard', () => {
  // A card is read before it is pointed at, so the pair opens halved rather
  // than showing only one of its two sides.
  it('opens the pair split down the middle', () => {
    mount()

    expect(seam().getAttribute('style')).toContain('inset(0 50% 0 0)')
  })

  it('follows the pointer across the artwork', async () => {
    mount()
    // The artwork has no size of its own under happy-dom, and the seam is
    // placed against the width the browser would give it.
    Object.defineProperty(
      screen.getByTestId('catalogue-card-frame'),
      'getBoundingClientRect',
      { value: () => ({ left: 100, width: 200 }) }
    )

    await userEvent.pointer({
      target: screen.getByTestId('catalogue-card'),
      coords: { clientX: 250, clientY: 10 }
    })

    expect(seam().getAttribute('style')).toContain('inset(0 25% 0 0)')
  })

  // Two stills that are not a before and an after say nothing about where the
  // seam belongs, so they keep the crossfade.
  it('leaves a pair that is not a comparison alone', () => {
    mount({ compare: false })

    expect(screen.queryByTestId('catalogue-card-compare')).toBeNull()
    expect(screen.getByTestId('catalogue-card-still')).toBeTruthy()
  })

  // The link and the heading both carry the name. Artwork that carries it too
  // reads the same card out three times to anyone not looking at it.
  it('names itself once to anyone who cannot see it', () => {
    mount({ compare: false })

    expect(screen.getAllByText('Remove an object')).toHaveLength(2)
    expect(screen.queryByAltText('Remove an object')).toBeNull()
  })

  it('shows one still on its own when there is no second one', () => {
    mount({ hoverMedia: undefined })

    expect(screen.queryByTestId('catalogue-card-compare')).toBeNull()
  })
})
