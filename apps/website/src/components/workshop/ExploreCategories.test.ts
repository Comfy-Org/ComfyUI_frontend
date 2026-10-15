import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { WorkflowWorkshopModel } from '@/config/models-catalogue'
import { workflowModels } from '@/config/workshop-workflow-content'
import ExploreCategories from './ExploreCategories.vue'

const inSection = (section: string, stills: number) =>
  Array.from(
    { length: stills },
    (_, index): WorkflowWorkshopModel => ({
      type: 'CLOUD',
      workflowId: `${section}-${index}`,
      slug: `workflows/${section}-${index}`,
      name: `${section} ${index}`,
      href: `/hub/workflows/${section}-${index}/`,
      workflowCount: 0,
      capabilities: [],
      category: `type-${index}`,
      section,
      sectionOrder: stills,
      recommendedRank: index,
      sectionLabel: { en: section, 'zh-CN': section },
      thumbnail: { url: `/${section}-${index}.webp`, kind: 'image' }
    })
  )

describe('ExploreCategories', () => {
  it.for([
    { section: 'single', stills: 1 },
    { section: 'pair', stills: 2 },
    { section: 'trio', stills: 3 },
    { section: 'quad', stills: 4 },
    { section: 'many', stills: 6 }
  ])('fills the $section mosaic with what it has', ({ section, stills }) => {
    render(ExploreCategories, {
      props: { workflows: inSection(section, stills) }
    })

    const tile = screen.getByRole('link', { name: new RegExp(section) })
    expect(tile).toHaveAttribute('href', `/hub/workflows/#section-${section}`)
    expect(
      within(within(tile).getByTestId('explore-category-mosaic'))
        .queryAllByAltText('')
        .map((still) => still.getAttribute('src'))
    ).toEqual(
      Array.from(
        { length: Math.min(stills, 4) },
        (_, index) => `/${section}-${index}.webp`
      )
    )
    expect(tile).toHaveTextContent(
      `${stills} workflow${stills === 1 ? '' : 's'}`
    )
  })

  it('shows one tile per use-case section of the published workflows, each opening its section', () => {
    render(ExploreCategories, { props: { workflows: workflowModels } })

    const sections = [
      { id: 'videos', name: 'Create & edit videos' },
      { id: 'characters', name: 'Animate characters' },
      { id: 'product', name: 'Create product photos & ads' },
      { id: 'upscale', name: 'Upscale & restore' },
      { id: 'cleanup', name: 'Edit & clean up photos' }
    ]
    const tiles = screen.getAllByTestId('explore-category')
    expect(tiles.map((tile) => tile.getAttribute('href'))).toEqual(
      sections.map(({ id }) => `/hub/workflows/#section-${id}`)
    )
    for (const [index, { name }] of sections.entries()) {
      expect(tiles[index]).toHaveTextContent(name)
      expect(tiles[index]).toHaveTextContent('6 workflows')
    }
  })
})
