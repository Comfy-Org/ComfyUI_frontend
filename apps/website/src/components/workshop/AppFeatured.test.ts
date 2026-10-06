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
    { thumbnail: { url: '/images/studio.jpg', kind: 'image' }, shown: 1 },
    { thumbnail: undefined, shown: 0 }
  ] as const)(
    'shows the artwork only when the app has one: $thumbnail',
    ({ thumbnail, shown }) => {
      render(AppFeatured, { props: { app: { ...app, thumbnail } } })

      expect(screen.getByRole('link')).toHaveAttribute(
        'href',
        '/hub/apps/studio/'
      )
      expect(screen.queryAllByTestId('model-card-media')).toHaveLength(shown)
    }
  )
})
