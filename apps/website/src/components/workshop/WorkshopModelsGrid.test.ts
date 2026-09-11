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

function cardNames() {
  return screen.queryAllByRole('link').map((card) => card.textContent)
}

function search() {
  return screen.getByRole('combobox', {
    name: 'Search models, providers, categories...'
  })
}

describe('WorkshopModelsGrid', () => {
  afterEach(() => {
    history.replaceState(null, '', '/')
  })

  it('searches by name and provider', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })
    expect(cardNames()).toHaveLength(3)

    await user.type(search(), 'forest')
    expect(cardNames()).toEqual([expect.stringContaining('Flux')])
  })

  it('suggests popular models and narrows by a provider chip', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })
    expect(
      screen.queryByRole('button', { name: 'Flux Black Forest Labs' })
    ).toBeNull()

    await user.click(search())
    expect(
      screen.getAllByRole('button', {
        name: /^(?:Kling AI Kling|Flux Black Forest Labs|Mystery Partner node)$/i
      })
    ).toHaveLength(3)

    await user.click(screen.getByRole('button', { name: 'Kling 1' }))
    expect(cardNames()).toEqual([expect.stringContaining('Kling AI')])
  })

  it('fills the search from a suggested model', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })

    await user.click(search())
    await user.click(
      screen.getByRole('button', { name: 'Flux Black Forest Labs' })
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

    await user.click(screen.getByRole('button', { name: 'Filter' }))
    await user.click(await screen.findByRole('tab', { name: 'Capabilities' }))
    await user.click(await screen.findByRole('button', { name: 'Upscale 1' }))
    expect(cardNames()).toEqual([expect.stringContaining('Flux')])

    await user.click(
      screen.getAllByRole('button', { name: 'Clear filters' })[0]
    )
    expect(cardNames()).toHaveLength(3)
  })

  it('narrows the provider menu with its search box', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })

    await user.click(screen.getByRole('button', { name: 'Filter' }))
    await user.click(await screen.findByRole('tab', { name: 'Models' }))
    await user.type(
      await screen.findByRole('searchbox', { name: 'Search…' }),
      'forest'
    )
    expect(screen.queryByRole('button', { name: 'Kling 1' })).toBeNull()
    await user.click(
      screen.getByRole('button', { name: 'Black Forest Labs 1' })
    )
    expect(cardNames()).toEqual([expect.stringContaining('Flux')])
  })

  it('sorts by example count by default and by name on request', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })
    await user.type(search(), ' ')
    expect(cardNames()[0]).toContain('Kling AI')

    await user.click(screen.getByRole('button', { name: 'Sort' }))
    await user.click(
      await screen.findByRole('menuitemradio', { name: 'Name A to Z' })
    )
    expect(cardNames()[0]).toContain('Flux')
  })

  it('clears search and filters together from the empty state', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })
    await user.type(search(), 'nothing')
    expect(screen.getByText('No models match')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(cardNames()).toHaveLength(3)
  })
})
