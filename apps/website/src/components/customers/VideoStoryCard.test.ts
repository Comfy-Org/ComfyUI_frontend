// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import VideoStoryCard from './VideoStoryCard.vue'

const story = {
  slug: 'black-math',
  company: 'Black Math',
  category: 'CASE STUDY',
  title: 'How Black Math builds interactive design systems with ComfyUI',
  description: 'A synopsis of the Black Math story.',
  poster: 'https://media.comfy.org/website/customers/blackmath/poster.webp',
  posterWidth: 1280,
  posterHeight: 720
}

describe('VideoStoryCard', () => {
  it('links to the watch page for the story slug', () => {
    render(VideoStoryCard, { props: { story } })

    const card = screen.getByRole('link')
    expect(card).toHaveProperty(
      'href',
      expect.stringContaining('/customers/videos/black-math')
    )
  })

  it('renders the company, title, synopsis, and WATCH STORY CTA', () => {
    render(VideoStoryCard, { props: { story } })

    expect(screen.getByText(/Black Math · CASE STUDY/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: story.title })).toBeTruthy()
    expect(screen.getByText(story.description)).toBeTruthy()
    expect(screen.getByText('WATCH STORY')).toBeTruthy()
  })

  it('renders the poster with the story dimensions', () => {
    render(VideoStoryCard, { props: { story } })

    const poster = screen.getByRole('img', {
      name: `${story.company}: ${story.title}`
    })
    expect(poster).toHaveProperty('src', story.poster)
    expect(poster.getAttribute('width')).toBe('1280')
    expect(poster.getAttribute('height')).toBe('720')
  })

  it('omits the duration chip when no duration is given', () => {
    render(VideoStoryCard, { props: { story } })

    expect(screen.queryByText(/^\d+:\d{2}$/)).toBeNull()
  })

  it('shows the duration chip when a duration string is given', () => {
    render(VideoStoryCard, { props: { story: { ...story, duration: '4:32' } } })

    expect(screen.getByText('4:32')).toBeTruthy()
  })
})
