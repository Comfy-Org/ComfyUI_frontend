// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'

import type { WorkshopModel } from '../../config/models-catalogue'
import WorkshopModelsGrid from './WorkshopModelsGrid.vue'

const models: WorkshopModel[] = [
  {
    slug: 'kling-ai',
    name: 'Kling AI',
    workflowCount: 3,
    href: '/models/kling-ai/',
    routerId: 'kling/kling-ai',
    capabilities: [],
    provider: 'Kling',
    modality: 'video',
    task: 'text-to-video',
    creditsPerRun: 24
  },
  {
    slug: 'flux',
    name: 'Flux',
    workflowCount: 2,
    href: '/models/flux/',
    routerId: 'bfl/flux',
    capabilities: ['Upscale'],
    provider: 'Black Forest Labs',
    modality: 'image',
    task: 'image-to-image',
    creditsPerRun: 8
  },
  {
    slug: 'mystery',
    name: 'Mystery',
    workflowCount: 1,
    href: '/models/mystery/',
    routerId: 'comfy/mystery',
    capabilities: []
  }
]

const cardNames = () =>
  screen.queryAllByTestId('workshop-model-card').map((card) => card.textContent)

describe('WorkshopModelsGrid', () => {
  afterEach(() => {
    history.replaceState(null, '', '/')
  })

  it('searches by name and provider', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })
    expect(cardNames()).toHaveLength(3)

    await user.type(screen.getByTestId('workshop-search'), 'forest')
    expect(cardNames()).toEqual([expect.stringContaining('Flux')])
  })

  it('suggests popular models and narrows by a provider chip', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })
    expect(screen.queryByTestId('workshop-search-panel')).toBeNull()

    await user.click(screen.getByTestId('workshop-search'))
    expect(
      screen
        .getAllByTestId('workshop-search-model')
        .map((row) => row.textContent)
    ).toHaveLength(3)

    await user.click(
      screen
        .getAllByTestId('workshop-search-provider')
        .filter((chip) => chip.textContent.includes('Kling'))[0]
    )
    expect(cardNames()).toEqual([expect.stringContaining('Kling AI')])
  })

  it('fills the search from a suggested model', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })

    await user.click(screen.getByTestId('workshop-search'))
    await user.click(
      screen
        .getAllByTestId('workshop-search-model')
        .filter((row) => row.textContent.includes('Flux'))[0]
    )
    expect(cardNames()).toEqual([expect.stringContaining('Flux')])
  })

  it('narrows the grid to one use case', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })

    await user.click(screen.getByRole('button', { name: 'Edit images 1' }))
    expect(
      screen.getByRole('heading', { level: 1, name: 'Edit images 1' })
    ).toBeTruthy()
    expect(cardNames()).toEqual([expect.stringContaining('Flux')])

    await user.click(screen.getByRole('button', { name: /Back to/ }))
    await user.click(screen.getByRole('button', { name: 'Generate videos 1' }))
    expect(cardNames()).toEqual([expect.stringContaining('Kling AI')])
  })

  it('filters by capability from the filter menu', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })

    await user.click(screen.getByTestId('workshop-filter'))
    await user.click(await screen.findByTestId('workshop-facet-capability'))
    await user.click(await screen.findByTestId('filter-capability-Upscale'))
    expect(cardNames()).toEqual([expect.stringContaining('Flux')])

    await user.click(screen.getByTestId('workshop-filter-clear'))
    expect(cardNames()).toHaveLength(3)
  })

  it('narrows the provider menu with its search box', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })

    await user.click(screen.getByTestId('workshop-filter'))
    await user.click(await screen.findByTestId('workshop-facet-provider'))
    await user.type(
      await screen.findByTestId('workshop-filter-provider-search'),
      'forest'
    )
    expect(screen.queryByTestId('filter-provider-Kling')).toBeNull()
    await user.click(screen.getByTestId('filter-provider-Black Forest Labs'))
    expect(cardNames()).toEqual([expect.stringContaining('Flux')])
  })

  it('sorts by example count by default and by name on request', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })
    await user.type(screen.getByTestId('workshop-search'), ' ')
    expect(cardNames()[0]).toContain('Kling AI')

    await user.click(screen.getByTestId('workshop-sort'))
    await user.click(await screen.findByTestId('sort-name'))
    expect(cardNames()[0]).toContain('Flux')
  })

  it('clears search and filters together from the empty state', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })
    await user.type(screen.getByTestId('workshop-search'), 'nothing')
    expect(screen.getByTestId('workshop-empty')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(cardNames()).toHaveLength(3)
  })
})
