import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { CatalogueApp } from '@/lib/workshop/catalogue-apps'
import WorkshopAppCard from './WorkshopAppCard.vue'

const app: CatalogueApp = {
  key: 'reshoot',
  name: 'Re-shoot a video',
  task: 'Re-shoot from any angle',
  href: '/cinematic-studio?app=reshoot'
}

describe('WorkshopAppCard', () => {
  it('links to the app and names it and what it makes', () => {
    render(WorkshopAppCard, { props: { app } })
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/cinematic-studio?app=reshoot')
    expect(
      screen.getByRole('heading', { name: 'Re-shoot a video' })
    ).toBeVisible()
    expect(screen.getByTestId('app-card-task')).toHaveTextContent(
      'Re-shoot from any angle'
    )
  })

  it('reads its name under the artwork, never over it', () => {
    render(WorkshopAppCard, {
      props: {
        app: { ...app, thumbnail: { url: '/images/app.jpg', kind: 'image' } }
      }
    })

    expect(
      within(screen.getByTestId('app-card-artwork')).queryByRole('heading'),
      'A name over the artwork covers the picture it is naming'
    ).toBeNull()
    expect(
      screen.getByRole('heading', { name: 'Re-shoot a video' })
    ).toBeVisible()
  })

  it('marks an app with the logo its name matches', () => {
    render(WorkshopAppCard, {
      props: { app: { ...app, name: 'Seedance Studio' } }
    })
    const mark = screen.getByTestId('model-card-provider')

    expect(mark).toHaveTextContent('Comfy app')
    expect(within(mark).getByTestId('model-card-provider-logo')).toHaveStyle({
      maskImage: 'url(/icons/ai-models/bytedance.svg)'
    })
    expect(within(mark).queryByText('C', { exact: true })).toBeNull()
  })

  it('marks an app with the initial when no logo matches', () => {
    render(WorkshopAppCard, { props: { app } })
    const mark = screen.getByTestId('model-card-provider')

    expect(mark).toHaveTextContent('Comfy app')
    expect(within(mark).queryByTestId('model-card-provider-logo')).toBeNull()
    expect(within(mark).getByText('C', { exact: true })).toBeInTheDocument()
  })

  it.for([
    {
      thumbnail: { url: '/images/app.jpg', kind: 'image' },
      media: 'IMG',
      poster: null,
      placeholder: 0
    },
    {
      thumbnail: {
        url: '/media/app.mp4',
        kind: 'video',
        poster: '/media/app.jpg'
      },
      media: 'VIDEO',
      poster: '/media/app.jpg',
      placeholder: 0
    },
    { thumbnail: undefined, media: undefined, poster: null, placeholder: 1 }
  ] as const)(
    'shows $media artwork, or the initial without any',
    ({ thumbnail, media, placeholder, poster }) => {
      render(WorkshopAppCard, { props: { app: { ...app, thumbnail } } })
      const artwork = screen.queryByTestId('model-card-media')
      expect(artwork?.tagName).toBe(media)
      expect(artwork?.getAttribute('poster') ?? null).toBe(poster)
      expect(screen.queryAllByTestId('model-media-placeholder')).toHaveLength(
        placeholder
      )
    }
  )
})
