// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'

import type { WorkshopBrowseModel } from '../../config/workshop'
import WorkshopCatalog from './WorkshopCatalog.vue'

const models: WorkshopBrowseModel[] = [
  {
    id: 'bfl/flux',
    href: '/workshop/models/bfl--flux/',
    name: 'Flux',
    provider: 'bfl',
    output: 'image',
    description: 'Generates an image from text.',
    tags: ['text-to-image']
  },
  {
    id: 'kling/video',
    href: '/workshop/models/kling--video/',
    name: 'Kling Video',
    provider: 'kling',
    output: 'video',
    description: 'Animates an image.',
    tags: ['image-to-video']
  }
]

describe('WorkshopCatalog', () => {
  it('filters the rendered models by search, output, and provider', async () => {
    const user = userEvent.setup()
    render(WorkshopCatalog, {
      props: { models, detailRoutesAvailable: true }
    })

    expect(screen.getByRole('link', { name: /Flux/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Kling Video/ })).toBeTruthy()

    await user.type(screen.getByRole('searchbox'), 'animate')
    await nextTick()
    expect(screen.queryByRole('link', { name: /Flux/ })).toBeNull()
    expect(screen.getByRole('link', { name: /Kling Video/ })).toBeTruthy()

    await user.clear(screen.getByRole('searchbox'))
    await user.click(screen.getByRole('button', { name: /Image 1/ }))
    await nextTick()
    expect(screen.getByRole('link', { name: /Flux/ })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Kling Video/ })).toBeNull()

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Filter by provider' }),
      'kling'
    )
    await nextTick()
    expect(screen.getByText('No models match these filters.')).toBeTruthy()
  })

  it('renders the next page on request', async () => {
    const user = userEvent.setup()
    const manyModels = Array.from({ length: 49 }, (_, index) => ({
      ...models[0],
      id: `bfl/flux-${index + 1}`,
      href: `/workshop/models/bfl--flux-${index + 1}/`,
      name: `Flux ${index + 1}`
    }))
    render(WorkshopCatalog, {
      props: { models: manyModels, detailRoutesAvailable: true }
    })

    expect(screen.getAllByRole('link')).toHaveLength(48)
    expect(screen.queryByRole('link', { name: /Flux 49/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Show more models' }))
    await nextTick()
    expect(screen.getAllByRole('link')).toHaveLength(49)
    expect(screen.getByRole('link', { name: /Flux 49/ })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Image 49/ }))
    await nextTick()
    expect(screen.getAllByRole('link')).toHaveLength(48)
  })

  it('uses the singular result label for one model', () => {
    render(WorkshopCatalog, { props: { models: [models[0]] } })

    expect(screen.getByText('1 model')).toBeTruthy()
  })

  it('does not link cards until model-detail routes are available', () => {
    render(WorkshopCatalog, { props: { models } })

    expect(screen.queryAllByRole('link')).toEqual([])
    expect(screen.getAllByRole('article')).toHaveLength(2)
  })
})
