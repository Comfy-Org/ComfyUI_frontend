import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from '@/config/models-catalogue'
import WorkshopSearchPanel from './WorkshopSearchPanel.vue'

type ThumbnailFields = Pick<WorkshopModel, 'thumbnail' | 'thumbnailUrl'>

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

  const clip = 'https://comfy-hub-assets.comfy.org/uploads/3f2a9c'
  const still = 'https://media.comfy.org/still.webp'

  it.for<[string, ThumbnailFields, string]>([
    [
      'a declared video',
      { thumbnailUrl: clip, thumbnail: { url: clip, kind: 'video' } },
      clip
    ],
    [
      'a .mp4 URL with no declared kind',
      { thumbnailUrl: 'https://media.comfy.org/clip.mp4' },
      'https://media.comfy.org/clip.mp4'
    ],
    [
      'a declared video with no thumbnailUrl',
      { thumbnail: { url: clip, kind: 'video' } },
      clip
    ],
    [
      'a declared video whose thumbnailUrl names another file',
      { thumbnailUrl: still, thumbnail: { url: clip, kind: 'video' } },
      clip
    ]
  ])('shows %s as a still frame, not a broken image', ([, fields, src]) => {
    render(WorkshopSearchPanel, {
      props: { models: [{ ...models[1], ...fields }], query: 'alpha' }
    })
    expect(
      screen.getByTestId('workshop-search-model-video').getAttribute('src')
    ).toBe(`${src}#t=0.1`)
  })

  it.for<[string, ThumbnailFields]>([
    [
      'a declared audio thumbnail',
      {
        thumbnailUrl: 'https://media.comfy.org/sound',
        thumbnail: { url: 'https://media.comfy.org/sound', kind: 'audio' }
      }
    ],
    [
      'an .mp3 URL with no declared kind',
      { thumbnailUrl: 'https://media.comfy.org/sound.mp3' }
    ]
  ])('shows the initial instead of a broken image for %s', ([, fields]) => {
    render(WorkshopSearchPanel, {
      props: { models: [{ ...models[1], ...fields }], query: 'alpha' }
    })
    expect(screen.getByText('A')).toBeTruthy()
  })

  it.for<[string, ThumbnailFields, () => HTMLElement]>([
    [
      'video',
      { thumbnail: { url: clip, kind: 'video' } },
      () => screen.getByTestId('workshop-search-model-video')
    ],
    [
      'image',
      { thumbnailUrl: still },
      () => screen.getByTestId('workshop-search-model-image')
    ]
  ])(
    'shows the initial when the %s thumbnail fails to load',
    async ([, fields, media]) => {
      render(WorkshopSearchPanel, {
        props: { models: [{ ...models[1], ...fields }], query: 'alpha' }
      })
      expect(screen.queryByText('A')).toBeNull()
      await fireEvent.error(media())
      expect(screen.getByText('A')).toBeTruthy()
    }
  )

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
