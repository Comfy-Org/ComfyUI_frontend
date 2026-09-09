// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from '../../config/models-catalogue'
import FeaturedBanner from './FeaturedBanner.vue'

const base: WorkshopModel = {
  slug: 'flux',
  name: 'Flux',
  workflowCount: 2,
  href: '/workshop/models/flux/',
  routerId: 'bfl/flux',
  capabilities: ['Inpainting'],
  runs: 12_000,
  provider: 'Black Forest Labs',
  modality: 'image',
  task: 'text-to-image',
  summary: 'Photorealistic images with professional text rendering.'
}

const kling: WorkshopModel = {
  ...base,
  slug: 'kling',
  name: 'Kling',
  href: '/workshop/models/kling/',
  modality: 'video',
  task: 'image-to-video',
  summary: 'Turns a still frame into a short video.'
}

describe('FeaturedBanner', () => {
  it('leads with the first model and links the whole slide to its page', () => {
    render(FeaturedBanner, { props: { models: [base, kling] } })
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Flux')
    expect(screen.getByText('Text to Image')).toBeTruthy()
    expect(screen.getByTestId('featured-slide').getAttribute('href')).toBe(
      '/workshop/models/flux/'
    )
  })

  it('shows the model a pagination bar names', async () => {
    const user = userEvent.setup()
    render(FeaturedBanner, { props: { models: [base, kling] } })

    await user.click(screen.getByRole('button', { name: 'Kling' }))

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Kling')
    expect(screen.getByText(kling.summary ?? '')).toBeTruthy()
    expect(screen.getByTestId('featured-slide').getAttribute('href')).toBe(
      '/workshop/models/kling/'
    )
  })

  it('drops the pagination when there is nothing to page through', () => {
    render(FeaturedBanner, { props: { models: [base] } })
    expect(screen.queryByTestId('featured-pagination')).toBeNull()
  })
})
