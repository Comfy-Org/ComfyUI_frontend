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

  it.for([
    [
      'a declared video',
      'https://comfy-hub-assets.comfy.org/uploads/3f2a9c',
      'video'
    ],
    [
      'a .mp4 URL with no declared kind',
      'https://media.comfy.org/clip.mp4',
      undefined
    ]
  ] as const)(
    'shows %s as a still frame, not a broken image',
    ([, clip, kind]) => {
      const videoModel: WorkshopModel = {
        ...models[1],
        thumbnailUrl: clip,
        ...(kind ? { thumbnail: { url: clip, kind } } : {})
      }
      render(WorkshopSearchPanel, {
        props: { models: [videoModel], query: 'alpha' }
      })
      expect(
        screen.getByTestId('workshop-search-model-video').getAttribute('src')
      ).toBe(`${clip}#t=0.1`)
    }
  )

  it('shows the initial instead of a broken image for an audio thumbnail', () => {
    const sound = 'https://media.comfy.org/sound.mp3'
    render(WorkshopSearchPanel, {
      props: {
        models: [
          {
            ...models[1],
            thumbnailUrl: sound,
            thumbnail: { url: sound, kind: 'audio' }
          }
        ],
        query: 'alpha'
      }
    })
    expect(screen.getByText('A')).toBeTruthy()
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
