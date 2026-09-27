import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { CatalogueApp } from '../../lib/workshop/catalogue-apps'
import WorkshopAppCard from './WorkshopAppCard.vue'

const app: CatalogueApp = {
  key: 'reshoot',
  name: 'Re-shoot a video',
  summary: 'Aim a new camera at your clip.',
  href: '/cinematic-studio?app=reshoot'
}

describe('WorkshopAppCard', () => {
  it('links to the app and shows its name and summary', () => {
    render(WorkshopAppCard, { props: { app } })
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/cinematic-studio?app=reshoot')
    expect(
      screen.getByRole('heading', { name: 'Re-shoot a video' })
    ).toBeVisible()
    expect(screen.getByText('Aim a new camera at your clip.')).toBeVisible()
  })

  it('reads its name under the artwork, never over it', () => {
    render(WorkshopAppCard, {
      props: { app: { ...app, image: '/images/app.jpg' } }
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
    { image: '/images/app.jpg', placeholder: 0 },
    { image: undefined, placeholder: 1 }
  ])(
    'falls back to the initial only without artwork ($image)',
    ({ image, placeholder }) => {
      render(WorkshopAppCard, { props: { app: { ...app, image } } })
      expect(screen.queryAllByTestId('app-media-placeholder')).toHaveLength(
        placeholder
      )
    }
  )
})
