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
  it('opens the app in a new tab and names it and what it makes', () => {
    render(WorkshopAppCard, { props: { app, meta: 'Video · MiniMax H3' } })
    const link = screen.getByRole('link', { name: /opens in a new tab/ })
    expect(link).toHaveAttribute('href', '/cinematic-studio?app=reshoot')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener')
    expect(screen.getByTestId('app-card-status')).toHaveTextContent('Open')
    expect(
      screen.getByRole('heading', { name: 'Re-shoot a video' })
    ).toBeVisible()
    expect(screen.getByTestId('app-card-task')).toHaveTextContent(
      'Re-shoot from any angle'
    )
    expect(link).toHaveTextContent('Video · MiniMax H3')
  })

  it('shows an app without a page as coming soon, and opens nothing', () => {
    render(WorkshopAppCard, { props: { app: { ...app, href: undefined } } })
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByTestId('workshop-app-card')).toHaveAttribute(
      'aria-disabled',
      'true'
    )
    expect(screen.getByTestId('app-card-status')).toHaveTextContent('Soon')
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
