// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from '../../config/workshop'
import WorkshopModelsGrid from './WorkshopModelsGrid.vue'

const models: WorkshopModel[] = [
  {
    slug: 'kling-ai',
    name: 'Kling AI',
    workflowCount: 3,
    href: '/workshop/models/kling-ai/',
    routerId: 'kling/kling-ai',
    provider: 'Kling',
    modality: 'video',
    task: 'text-to-video',
    creditsPerRun: 24
  },
  {
    slug: 'flux',
    name: 'Flux',
    workflowCount: 2,
    href: '/workshop/models/flux/',
    routerId: 'bfl/flux',
    provider: 'Black Forest Labs',
    modality: 'image',
    task: 'image-to-image',
    creditsPerRun: 8
  },
  {
    slug: 'mystery',
    name: 'Mystery',
    workflowCount: 1,
    href: '/workshop/models/mystery/',
    routerId: 'comfy/mystery'
  }
]

const cardNames = () =>
  screen
    .queryAllByTestId('workshop-model-card')
    .map((card) => card.textContent ?? '')

describe('WorkshopModelsGrid', () => {
  it('searches by name and provider', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })
    expect(cardNames()).toHaveLength(3)

    await user.type(screen.getByTestId('workshop-search'), 'forest')
    expect(cardNames()).toEqual([expect.stringContaining('Flux')])
  })

  it('combines modality, task and provider filters from the Filter menu', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })

    await user.click(screen.getByTestId('workshop-filter'))
    await user.click(await screen.findByTestId('filter-modality-video'))
    expect(cardNames()).toEqual([expect.stringContaining('Kling AI')])
    expect(screen.getByTestId('workshop-filter-count').textContent).toBe('1')

    await user.click(screen.getByTestId('filter-task-image-to-image'))
    expect(cardNames()).toHaveLength(0)
    expect(screen.getByTestId('workshop-empty')).toBeTruthy()

    await user.click(screen.getByTestId('workshop-filter-clear'))
    expect(cardNames()).toHaveLength(3)
  })

  it('sorts by popularity by default and by name on request', async () => {
    const user = userEvent.setup()
    render(WorkshopModelsGrid, { props: { models } })
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
