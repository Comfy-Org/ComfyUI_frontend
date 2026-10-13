import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { WorkflowWorkshopModel } from '@/config/models-catalogue'
import ExploreCategories from './ExploreCategories.vue'

const inCategory = (category: string, stills: number) =>
  Array.from(
    { length: stills },
    (_, index): WorkflowWorkshopModel => ({
      type: 'CLOUD',
      workflowId: `${category}-${index}`,
      slug: `workflows/${category}-${index}`,
      name: `${category} ${index}`,
      href: `/hub/workflows/${category}-${index}/`,
      workflowCount: 0,
      capabilities: [],
      category,
      categoryOrder: stills,
      recommendedRank: index,
      categoryLabel: { en: category, 'zh-CN': category },
      thumbnail: { url: `/${category}-${index}.webp`, kind: 'image' }
    })
  )

describe('ExploreCategories', () => {
  it.for([
    { category: 'single', stills: 1 },
    { category: 'pair', stills: 2 },
    { category: 'trio', stills: 3 },
    { category: 'quad', stills: 4 },
    { category: 'many', stills: 6 }
  ])('fills the $category mosaic with what it has', ({ category, stills }) => {
    render(ExploreCategories, {
      props: { workflows: inCategory(category, stills) }
    })

    const tile = screen.getByRole('link', { name: new RegExp(category) })
    expect(tile).toHaveAttribute('href', `/hub/workflows/?category=${category}`)
    expect(
      within(within(tile).getByTestId('explore-category-mosaic'))
        .queryAllByAltText('')
        .map((still) => still.getAttribute('src'))
    ).toEqual(
      Array.from(
        { length: Math.min(stills, 4) },
        (_, index) => `/${category}-${index}.webp`
      )
    )
    expect(tile).toHaveTextContent(
      `${stills} workflow${stills === 1 ? '' : 's'}`
    )
  })
})
