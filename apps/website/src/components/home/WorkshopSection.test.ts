// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { WorkshopBrowseModel } from '../../config/workshop'
import WorkshopSection from './WorkshopSection.vue'

const models: WorkshopBrowseModel[] = [
  {
    id: 'bfl/flux-2-pro',
    slug: 'bfl--flux-2-pro',
    href: '/workshop/models/bfl--flux-2-pro/',
    name: 'FLUX 2 Pro',
    provider: 'bfl',
    output: 'image',
    description: 'Generates an image.',
    tags: ['text-to-image']
  },
  {
    id: 'kling/text-to-video',
    slug: 'kling--text-to-video',
    href: '/workshop/models/kling--text-to-video/',
    name: 'Kling 2.5 Turbo',
    provider: 'kling',
    output: 'video',
    description: 'Generates a video.',
    tags: []
  }
]

function renderSection() {
  render(WorkshopSection, { props: { models } as never })
}

describe('WorkshopSection', () => {
  it('links each featured model to its own page', () => {
    renderSection()

    expect(
      screen.getByRole('link', { name: /FLUX 2 Pro/ }).getAttribute('href')
    ).toBe('/workshop/models/bfl--flux-2-pro/')
    expect(
      screen.getByRole('link', { name: /Kling 2.5 Turbo/ }).getAttribute('href')
    ).toBe('/workshop/models/kling--text-to-video/')
  })

  it('offers a way through to the whole catalog', () => {
    renderSection()

    expect(
      screen
        .getByRole('link', { name: 'Browse all models' })
        .getAttribute('href')
    ).toBe('/workshop/')
  })

  it('shows what each model produces alongside who makes it', () => {
    renderSection()

    const card = screen.getByRole('link', { name: /FLUX 2 Pro/ })
    expect(card.textContent).toContain('bfl')
    expect(card.textContent).toContain('image')
    expect(card.textContent).toContain('Generates an image.')
  })

  it('renders nothing but the heading when there is nothing to feature', () => {
    // The homepage gates on this being empty while Workshop is unlisted, so
    // an empty list has to be a quiet no-op rather than a broken grid.
    render(WorkshopSection, { props: { models: [] } as never })

    expect(
      screen.queryAllByRole('link', { name: /Browse all models/ })
    ).toHaveLength(1)
    expect(screen.queryByRole('listitem')).toBeNull()
  })
})
