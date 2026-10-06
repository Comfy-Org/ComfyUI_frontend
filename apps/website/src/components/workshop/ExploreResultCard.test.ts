import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ExploreResultCard from './ExploreResultCard.vue'

describe('ExploreResultCard', () => {
  it.for([
    {
      art: 'an app still',
      model: {
        name: 'Relight',
        thumbnail: { url: '/still.jpg', kind: 'image' }
      },
      images: ['/still.jpg']
    },
    { art: 'nothing', model: undefined, images: [] }
  ] as const)('reads as a name and one line with $art', ({ model, images }) => {
    render(ExploreResultCard, {
      props: {
        href: '/hub/apps/x/',
        name: 'Relight',
        detail: 'Light a photo again',
        model
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
