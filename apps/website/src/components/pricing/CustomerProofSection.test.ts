// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { customerVideoStories } from '../../data/customerVideos'
import CustomerProofSection from './CustomerProofSection.vue'

describe('CustomerProofSection', () => {
  it('renders the heading and one link per customer video story', () => {
    render(CustomerProofSection)

    expect(screen.getByText('Built with ComfyUI')).toBeTruthy()

    for (const story of customerVideoStories) {
      const link = screen.getByRole('link', { name: new RegExp(story.title) })
      expect(link).toHaveProperty(
        'href',
        expect.stringContaining(`/customers/videos/${story.slug}`)
      )
    }
  })

  it('links each card to a distinct watch page', () => {
    render(CustomerProofSection)

    const hrefs = screen
      .getAllByRole('link')
      .map((link) => (link as HTMLAnchorElement).pathname)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })
})
