import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import type { WorkshopModel } from '@/config/models-catalogue'
import {
  setAllIntersecting,
  stubIntersectionObserver
} from '@/test/fakeIntersectionObserver'
import WorkshopModelCard from './WorkshopModelCard.vue'

const base: WorkshopModel = {
  slug: 'flux',
  name: 'Flux',
  workflowCount: 2,
  href: '/models/flux/',
  routerId: 'bfl/flux',
  capabilities: [],
  provider: 'Black Forest Labs',
  modality: 'image',
  task: 'image-to-image'
}

const widthProps = ['clientWidth', 'offsetWidth'] as const
const nativeWidths = widthProps.map(
  (name) =>
    [
      name,
      Object.getOwnPropertyDescriptor(HTMLElement.prototype, name)
    ] as const
)

describe('WorkshopModelCard', () => {
  afterEach(() => {
    for (const [name, descriptor] of nativeWidths)
      if (descriptor)
        Object.defineProperty(HTMLElement.prototype, name, descriptor)
  })

  it('links the name, provider badge and task to the model page', () => {
    render(WorkshopModelCard, { props: { model: base } })
    const link = screen.getByTestId('workshop-model-card')
    expect(link.getAttribute('href')).toBe('/models/flux/')
    expect(screen.getByTestId('model-card-name').textContent).toBe('Flux')
    expect(screen.getByTestId('model-card-provider')).toHaveTextContent(
      'Black Forest Labs'
    )
    expect(screen.getByTestId('model-card-task').textContent).toBe(
      'Image to Image'
    )
    expect(screen.queryByText(/credits|\$/)).toBeNull()
    expect(screen.queryByTestId('model-incomplete-badge')).toBeNull()
    expect(screen.getByTestId('model-media-placeholder')).toBeTruthy()
    expect(screen.queryByRole('img', { name: 'Flux' })).toBeNull()
    expect(screen.getAllByLabelText('Flux')).toEqual([screen.getByRole('link')])
  })

  // The artwork is decorative: the mark says who made this and the heading
  // says what it is, so a reader hears each of them once.
  it('names the card link by its provider and then the model', () => {
    render(WorkshopModelCard, {
      props: {
        model: {
          ...base,
          thumbnail: { kind: 'image', url: 'https://assets.example/flux' }
        }
      }
    })
    expect(screen.getByRole('link')).toHaveAccessibleName(
      'Black Forest Labs Flux Image to Image'
    )
    expect(screen.queryByRole('img', { name: 'Flux' })).toBeNull()
  })

  it('names the card without its tags and nests no control in the link', async () => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 120
    })
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get: () => 100
    })
    render(WorkshopModelCard, {
      props: {
        model: { ...base, capabilities: ['upscale', 'inpaint', 'controlnet'] }
      }
    })
    await nextTick()
    await nextTick()
    expect(screen.getByTestId('tag-overflow')).toBeTruthy()
    expect(screen.getByRole('link')).toHaveAccessibleName(
      'Black Forest Labs Flux Image to Image'
    )
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('names a hub card with its kind badge after the provider', () => {
    render(WorkshopModelCard, { props: { model: base, providerBadge: true } })
    expect(screen.getByRole('link')).toHaveAccessibleName(
      'Black Forest Labs Models Flux Image to Image'
    )
  })

  it.for([
    { locale: 'en', label: 'Incomplete' },
    { locale: 'zh-CN', label: '尚未完善' }
  ] as const)(
    'labels incomplete models in $locale without disabling the page link',
    ({ locale, label }) => {
      render(WorkshopModelCard, {
        props: {
          model: { ...base, incompleteReason: 'missing-input-schema' },
          locale
        }
      })
      expect(screen.getByText(label)).toBeTruthy()
      expect(
        screen
          .getByRole('link', { name: new RegExp(label) })
          .getAttribute('href')
      ).toBe(base.href)
    }
  )

  it('falls back to the provider initial and the modality when nothing matches', () => {
    render(WorkshopModelCard, {
      props: {
        model: { ...base, name: 'Mystery', provider: 'Nobody', task: undefined }
      }
    })
    expect(screen.getByText('N')).toBeTruthy()
    expect(screen.getByTestId('model-card-task').textContent).toBe('Image')
  })

  it('keeps an offscreen video unloaded while retaining the accessible model link', async () => {
    render(WorkshopModelCard, {
      props: {
        model: {
          ...base,
          thumbnail: {
            url: 'https://assets.example/preview.mp4',
            kind: 'video'
          }
        }
      }
    })
    await nextTick()
    const video = screen.getByTestId<HTMLVideoElement>('model-card-media')
    expect(video).not.toHaveAttribute('src')
    expect(video.paused).toBe(true)
    // The artwork is decorative; the name a reader hears comes from the link.
    expect(screen.getByRole('link', { name: /Flux/ })).toHaveAttribute(
      'href',
      base.href
    )
    expect(screen.getAllByLabelText('Flux')).toEqual([screen.getByRole('link')])
  })

  // Artwork that repeats the name gives a screen reader the model twice. The
  // card's name lives on the link; the picture is decorative, whichever kind it
  // is, so it carries no accessible name of its own.
  it.for(['image', 'video'] as const)(
    'keeps %s artwork out of the accessible name',
    (kind) => {
      render(WorkshopModelCard, {
        props: {
          model: {
            ...base,
            thumbnail: { kind, url: 'https://assets.example/a' }
          }
        }
      })

      expect(
        screen.queryAllByRole('img', { name: /./ }),
        'Artwork that names itself is read out before the card it decorates'
      ).toHaveLength(0)
      expect(
        screen.getByRole('link', { name: /Black Forest Labs/ })
      ).toBeVisible()
      expect(screen.getAllByLabelText('Flux')).toEqual([
        screen.getByRole('link')
      ])
      if (kind === 'video')
        expect(screen.getByTestId('model-card-media')).toHaveAttribute(
          'aria-hidden',
          'true'
        )
      expect(
        screen.getByRole('link', { name: /Flux/ }).getAttribute('href')
      ).toBe(base.href)
    }
  )

  it('attaches the video source once the card is on screen', async () => {
    stubIntersectionObserver()
    render(WorkshopModelCard, {
      props: {
        model: {
          ...base,
          thumbnail: {
            url: 'https://assets.example/preview.mp4',
            kind: 'video'
          }
        }
      }
    })
    await setAllIntersecting(true)
    expect(screen.getByTestId('model-card-media')).toHaveAttribute(
      'src',
      'https://assets.example/preview.mp4'
    )
  })

  it.for(['image', 'video'] as const)(
    'labels a shared %s thumbnail without replacing its name or destination',
    (kind) => {
      render(WorkshopModelCard, {
        props: {
          model: {
            ...base,
            name: 'Flux Turbo',
            thumbnail: { kind, url: 'https://assets.example/shared' },
            thumbnailLabel: 'Turbo'
          }
        }
      })
      expect(screen.getByTestId('model-thumbnail-label').textContent).toBe(
        'Turbo'
      )
      expect(screen.getByTestId('model-card-name').textContent).toBe(
        'Flux Turbo'
      )
      expect(
        screen.getByRole('link', { name: /Flux Turbo/ }).getAttribute('href')
      ).toBe(base.href)
    }
  )

  it.for([false, true])(
    'keeps incomplete status alongside the variant label (hub: %s)',
    (providerBadge) => {
      render(WorkshopModelCard, {
        props: {
          providerBadge,
          model: {
            ...base,
            incompleteReason: 'missing-input-schema',
            thumbnail: { kind: 'image', url: 'https://assets.example/shared' },
            thumbnailLabel: 'Pro'
          }
        }
      })
      expect(screen.getByText('Incomplete')).toBeTruthy()
      expect(screen.getByTestId('model-thumbnail-label').textContent).toBe(
        'Pro'
      )
    }
  )

  it.for([
    { ...base, thumbnailLabel: 'Turbo' },
    {
      ...base,
      thumbnail: {
        kind: 'image',
        url: 'https://assets.example/unique'
      } as const
    }
  ])('leaves fallback and unlabelled artwork unmarked', (card) => {
    render(WorkshopModelCard, { props: { model: card } })
    expect(screen.queryByTestId('model-thumbnail-label')).toBeNull()
  })

  it.for([
    {
      kind: 'a workflow, whose name is a sentence',
      model: {
        type: 'CLOUD',
        workflowId: 'workflows/upscale-a-video',
        slug: 'workflows/upscale-a-video',
        name: 'Upscale a video',
        href: '/models/workflows/upscale-a-video/',
        workflowCount: 1,
        capabilities: [],
        models: ['Topaz'],
        modality: 'video'
      },
      shown: 'Upscale a video'
    },
    {
      kind: 'a model, whose name repeats its task as a suffix',
      model: { ...base, name: 'Flux Image-to-Image' },
      shown: 'Flux'
    }
  ] as const)('shows the whole name of $kind', ({ model, shown }) => {
    render(WorkshopModelCard, { props: { model } })
    expect(screen.getByTestId('model-card-name').textContent).toBe(shown)
  })

  it.for([
    { kind: 'a hosted model', model: base, badges: ['Run', 'API'] },
    {
      kind: 'a workflow',
      model: {
        type: 'CLOUD',
        workflowId: 'workflows/upscale-a-video',
        slug: 'workflows/upscale-a-video',
        name: 'Upscale a video',
        href: '/models/workflows/upscale-a-video/',
        workflowCount: 1,
        capabilities: [],
        modality: 'video'
      },
      badges: []
    }
  ] satisfies {
    kind: string
    model: WorkshopModel
    badges: string[]
  }[])('says how $kind can be used', ({ model, badges }) => {
    render(WorkshopModelCard, { props: { model } })
    expect(
      screen
        .queryAllByTestId('model-access-badge')
        .map((badge) => badge.textContent.trim())
    ).toEqual(badges)
  })
})
