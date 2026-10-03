import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import AppFeatured from './AppFeatured.vue'

const app = {
  key: 'apps/studio',
  name: 'Studio',
  task: 'Direct a shot',
  href: '/hub/apps/studio/'
}

describe('AppFeatured', () => {
  it.for([
    { image: '/images/studio.jpg', shown: 1 },
    { image: undefined, shown: 0 }
  ])(
    'shows the artwork only when the app has one: $image',
    ({ image, shown }) => {
      render(AppFeatured, { props: { app: { ...app, image } } })

      expect(screen.getByRole('link')).toHaveAttribute(
        'href',
        '/hub/apps/studio/'
      )
      expect(screen.queryAllByTestId('app-featured-image')).toHaveLength(shown)
    }
  )
})
