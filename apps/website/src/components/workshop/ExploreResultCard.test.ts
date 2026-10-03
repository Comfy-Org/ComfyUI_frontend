import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ExploreResultCard from './ExploreResultCard.vue'

describe('ExploreResultCard', () => {
  it.for([
    { art: 'an app still', image: '/still.jpg', images: ['/still.jpg'] },
    { art: 'nothing', image: undefined, images: [] }
  ])('reads as a name and one line with $art', ({ image, images }) => {
    render(ExploreResultCard, {
      props: {
        href: '/hub/apps/x/',
        name: 'Relight',
        detail: 'Light a photo again',
        image
      }
    })

    expect(screen.getByRole('link')).toHaveTextContent(
      /^\s*Relight\s*Light a photo again\s*$/
    )
    expect(
      screen.queryAllByAltText('').map((img) => img.getAttribute('src'))
    ).toEqual(images)
  })
})
