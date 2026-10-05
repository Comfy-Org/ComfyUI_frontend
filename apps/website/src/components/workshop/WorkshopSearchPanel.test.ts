import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from '@/config/models-catalogue'
import WorkshopSearchPanel from './WorkshopSearchPanel.vue'

const models: WorkshopModel[] = [
  {
    slug: 'zeta',
    name: 'Zeta',
    provider: 'Provider B',
    routerId: 'b/zeta',
    href: '/models/zeta/',
    workflowCount: 6,
    capabilities: ['Upscale']
  },
  {
    slug: 'alpha',
    name: 'Alpha',
    provider: 'Provider A',
    routerId: 'a/alpha',
    href: '/models/alpha/',
    workflowCount: 1,
    capabilities: ['Upscale']
  }
]

describe('WorkshopSearchPanel', () => {
  it('shows matching models only after a query is entered', async () => {
    const { rerender } = render(WorkshopSearchPanel, {
      props: { models, query: '' }
    })
    expect(screen.queryByRole('button')).toBeNull()

    await rerender({ query: 'upscale' })
    expect(
      screen.getAllByRole('button', { name: /^(Alpha|Zeta) Provider/ })
    ).toEqual([
      screen.getByRole('button', { name: 'Alpha Provider A' }),
      screen.getByRole('button', { name: 'Zeta Provider B' })
    ])
    expect(screen.queryByText(/popular|\d+.*runs/i)).toBeNull()
  })

  it('names a Workshop app as a Comfy app, not a provider', () => {
    const app: WorkshopModel = {
      type: 'APP',
      appId: 'reshoot',
      slug: 'apps/reshoot',
      name: 'Re-shoot a video',
      href: '/hub/apps/reshoot/',
      workflowCount: 0,
      capabilities: []
    }
    render(WorkshopSearchPanel, { props: { models: [app], query: 're-shoot' } })
    expect(
      screen.getByRole('button', { name: 'Re-shoot a video Comfy app' })
    ).toBeTruthy()
  })

  it('shows a video thumbnail as a still frame, not a broken image', () => {
    const clip = 'https://media.comfy.org/clip.mp4'
    const videoModel: WorkshopModel = {
      ...models[1],
      thumbnailUrl: clip,
      thumbnail: { url: clip, kind: 'video' }
    }
    render(WorkshopSearchPanel, {
      props: { models: [videoModel], query: 'alpha' }
    })
    expect(
      screen.getByTestId('workshop-search-model-video').getAttribute('src')
    ).toBe(`${clip}#t=0.1`)
  })

  it('shows an empty state for a query without matches', () => {
    render(WorkshopSearchPanel, {
      props: { models, query: 'missing' }
    })
    expect(screen.getByText(/no match/i)).toBeTruthy()
  })

  it.for(['{Enter}', ' '])('activates a model result with %s', async (key) => {
    const user = userEvent.setup()
    const { emitted } = render(WorkshopSearchPanel, {
      props: { models, query: 'alpha' }
    })
    screen.getByRole('button', { name: 'Alpha Provider A' }).focus()
    await user.keyboard(key)
    expect(emitted().pick).toEqual([[models[1]]])
  })
})
