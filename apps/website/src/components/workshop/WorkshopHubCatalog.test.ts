// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type { WorkshopModel } from '../../config/workshop'
import WorkshopHubCatalog from './WorkshopHubCatalog.vue'

const models: WorkshopModel[] = [
  {
    slug: 'wan',
    name: 'Wan 2.7',
    workflowCount: 3,
    href: '/workshop/models/wan/',
    routerId: 'wan/wan',
    capabilities: [],
    runs: 12_000,
    provider: 'Alibaba',
    modality: 'video',
    task: 'image-to-video'
  },
  {
    slug: 'flux',
    name: 'Flux.2 Pro',
    workflowCount: 2,
    href: '/workshop/models/flux/',
    routerId: 'bfl/flux',
    capabilities: [],
    runs: 8_000,
    provider: 'Black Forest Labs',
    modality: 'image',
    task: 'text-to-image'
  }
]

describe('WorkshopHubCatalog', () => {
  it('preselects the kind named in the URL', async () => {
    vi.stubGlobal('location', { search: '?kind=model' })
    render(WorkshopHubCatalog, { props: { models } })
    await nextTick()
    expect(
      screen.getByTestId('hub-kind-model').getAttribute('aria-selected')
    ).toBe('true')
    expect(screen.queryByTestId('hub-card-graph')).toBeNull()
  })

  it('mixes partner models with community items and links models to their page', () => {
    render(WorkshopHubCatalog, { props: { models } })
    const modelCards = screen.getAllByTestId('hub-card-model')
    expect(modelCards).toHaveLength(2)
    expect(modelCards[0].getAttribute('href')).toBe('/workshop/models/wan/')
    expect(screen.getByText('Wan 2.7: Image to Video')).toBeTruthy()
    expect(screen.getAllByTestId('hub-card-graph').length).toBeGreaterThan(0)
    expect(screen.getByTestId('hub-open-live').getAttribute('href')).toBe(
      'https://comfy.org/workflows/'
    )
  })

  it('narrows to partner models by chip and by search', async () => {
    const user = userEvent.setup()
    render(WorkshopHubCatalog, { props: { models } })

    await user.click(screen.getByTestId('hub-kind-model'))
    expect(screen.getAllByTestId('hub-card-model')).toHaveLength(2)
    expect(screen.queryByTestId('hub-card-graph')).toBeNull()
    expect(screen.queryByTestId('hub-card-app')).toBeNull()

    await user.type(screen.getByTestId('hub-search'), 'flux')
    expect(screen.getAllByTestId('hub-card-model')).toHaveLength(1)
    expect(screen.getByText('Flux.2 Pro: Text to Image')).toBeTruthy()
  })
})
