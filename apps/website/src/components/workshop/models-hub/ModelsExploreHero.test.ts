import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import type { RouterWorkshopModel } from '@/config/models-catalogue'
import { stubIntersectionObserver } from '@/test/fakeIntersectionObserver'
import ModelsExploreHero from './ModelsExploreHero.vue'

function launch(
  slug: string,
  name: string,
  extra: Partial<RouterWorkshopModel> = {}
): RouterWorkshopModel {
  return {
    slug,
    name,
    summary: `${name} summary`,
    workflowCount: 1,
    href: `/hub/models/${slug}/`,
    routerId: `byteplus/${slug}`,
    capabilities: [],
    provider: 'ByteDance',
    modality: 'image',
    task: 'text-to-image',
    ...extra
  }
}

const seedance = launch(
  'byteplus--seedance-2-5-text-to-video--generate-videos',
  'Seedance 2.5 Text-to-Video'
)
const seedream = launch(
  'byteplus--seedream-5-pro--generate-images',
  'Seedream 5.0 Pro',
  { priceEstimate: '~9.5 credits/Image' }
)

describe('ModelsExploreHero', () => {
  beforeEach(() => {
    stubIntersectionObserver()
  })

  it('features the newest launch first, by its maker, under the Models title', () => {
    render(ModelsExploreHero, { props: { models: [seedream, seedance] } })

    const hero = screen.getByTestId('models-hub-hero')
    expect(within(hero).getByRole('heading', { level: 1 })).toHaveTextContent(
      /^Models$/
    )
    expect(within(hero).getByTestId('featured-title')).toHaveTextContent(
      'Seedance 2.5 Text-to-Video'
    )
    expect(within(hero).getByTestId('featured-badge')).toHaveTextContent('New')
    expect(within(hero).getByTestId('model-card-provider')).toHaveTextContent(
      'ByteDance'
    )
  })

  it.for([
    { model: seedance, price: undefined },
    { model: seedream, price: '~9.5 credits/Image' }
  ])(
    'shows the price the catalogue serves for $model.name, and none without one',
    async ({ model, price }) => {
      const user = userEvent.setup()
      render(ModelsExploreHero, { props: { models: [seedream, seedance] } })

      await user.click(screen.getByRole('button', { name: model.name }))

      expect(screen.queryByTestId('featured-price')?.textContent.trim()).toBe(
        price
      )
    }
  )
})
