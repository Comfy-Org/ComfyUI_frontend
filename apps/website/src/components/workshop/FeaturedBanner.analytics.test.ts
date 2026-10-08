import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it } from 'vitest'

import type { WorkshopModel } from '@/config/models-catalogue'
import { modelSlides } from '@/lib/workshop/featured-slides'
import { stubIntersectionObserver } from '@/test/fakeIntersectionObserver'
import FeaturedBanner from './FeaturedBanner.vue'

const flux: WorkshopModel = {
  slug: 'flux',
  name: 'Flux',
  workflowCount: 2,
  href: '/models/flux/',
  routerId: 'bfl/flux',
  capabilities: [],
  modality: 'image',
  task: 'text-to-image'
}
const kling: WorkshopModel = {
  ...flux,
  slug: 'kling',
  name: 'Kling',
  href: '/models/kling/'
}

describe('FeaturedBanner analytics', () => {
  beforeEach(() => {
    stubIntersectionObserver()
  })

  it('says which slide was opened and where it sat', async () => {
    const user = userEvent.setup()
    const slides = modelSlides([flux, kling], 'en')
    const { emitted } = render(FeaturedBanner, {
      props: { slides, autoplay: false }
    })

    await user.click(screen.getByRole('link', { name: 'Try now' }))
    await user.click(screen.getByRole('button', { name: 'Kling' }))
    await user.click(screen.getByTestId('featured-slide-link'))

    expect(emitted().open).toEqual([
      [slides[0], 0],
      [slides[1], 1]
    ])
  })
})
