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

  it.for([
    {
      thumbnail: { url: '/images/app.jpg', kind: 'image' },
      media: 'IMG',
      placeholder: 0
    },
    {
      thumbnail: { url: '/media/app.mp4', kind: 'video' },
      media: 'VIDEO',
      placeholder: 0
    },
    { thumbnail: undefined, media: undefined, placeholder: 1 }
  ] as const)(
    'shows $media artwork, or the initial without any',
    ({ thumbnail, media, placeholder }) => {
      render(WorkshopAppCard, { props: { app: { ...app, thumbnail } } })
      expect(screen.queryByTestId('model-card-media')?.tagName).toBe(media)
      expect(screen.queryAllByTestId('model-media-placeholder')).toHaveLength(
        placeholder
      )
    }
  )
})
