// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { getCustomerVideoStory } from '../../data/customerVideos'
import CustomerWatchPage from './CustomerWatchPage.vue'

const blackMath = getCustomerVideoStory('black-math')
const silverside = getCustomerVideoStory('silverside-ai')

const stubs = {
  VideoPlayer: {
    props: ['src', 'poster'],
    template: '<div data-testid="video-player" :data-src="src" />'
  }
}

describe('CustomerWatchPage', () => {
  it('renders the breadcrumb, title, and description for the story', () => {
    render(CustomerWatchPage, {
      props: { story: blackMath, otherStories: [] },
      global: { stubs }
    })

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      blackMath.title
    )
    expect(screen.getByText(blackMath.description)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Home' })).toHaveProperty(
      'href',
      expect.stringContaining('/')
    )
    expect(
      screen.getByRole('link', { name: 'Customer Stories' })
    ).toHaveProperty('href', expect.stringContaining('/customers'))
  })

  it('passes the story media to the video player', () => {
    render(CustomerWatchPage, {
      props: { story: blackMath, otherStories: [] },
      global: { stubs }
    })

    expect(screen.getByTestId('video-player').dataset.src).toBe(
      blackMath.videoSrc
    )
  })

  it('omits the transcript section when no transcript is passed', () => {
    render(CustomerWatchPage, {
      props: { story: blackMath, otherStories: [] },
      global: { stubs }
    })

    expect(screen.queryByText('Transcript')).toBeNull()
  })

  it('renders every transcript paragraph when one is passed', () => {
    render(CustomerWatchPage, {
      props: {
        story: blackMath,
        otherStories: [],
        transcript: ['First paragraph.', 'Second paragraph.']
      },
      global: { stubs }
    })

    expect(screen.getByText('Transcript')).toBeTruthy()
    expect(screen.getByText('First paragraph.')).toBeTruthy()
    expect(screen.getByText('Second paragraph.')).toBeTruthy()
  })

  it('omits the duration chip when the story has no verified duration', () => {
    render(CustomerWatchPage, {
      props: { story: blackMath, otherStories: [] },
      global: { stubs }
    })

    expect(screen.queryByText(/^\d+:\d{2}$/)).toBeNull()
  })

  it('shows the duration chip once the story has a verified duration', () => {
    render(CustomerWatchPage, {
      props: {
        story: { ...blackMath, durationSeconds: 272 },
        otherStories: []
      },
      global: { stubs }
    })

    expect(screen.getByText('4:32')).toBeTruthy()
  })

  it('links to other stories in the related strip, excluding itself', () => {
    render(CustomerWatchPage, {
      props: { story: blackMath, otherStories: [silverside] },
      global: { stubs }
    })

    expect(screen.getByRole('link', { name: silverside.title })).toHaveProperty(
      'href',
      expect.stringContaining('/customers/videos/silverside-ai')
    )
  })

  it('shows the reciprocal written-story link only when one is given', () => {
    const { rerender } = render(CustomerWatchPage, {
      props: { story: silverside, otherStories: [] },
      global: { stubs }
    })
    expect(screen.queryByText('Read the written story')).toBeNull()

    return rerender({
      story: silverside,
      otherStories: [],
      relatedStoryHref: '/customers/svedka-silverside'
    }).then(() => {
      const link = screen.getByRole('link', {
        name: 'Read the written story'
      })
      expect(link).toHaveProperty(
        'href',
        expect.stringContaining('/customers/svedka-silverside')
      )
    })
  })

  it('always links back to the customer directory', () => {
    render(CustomerWatchPage, {
      props: { story: blackMath, otherStories: [] },
      global: { stubs }
    })

    expect(
      screen.getByRole('link', { name: 'BROWSE ALL CUSTOMER STORIES' })
    ).toHaveProperty('href', expect.stringContaining('/customers'))
  })
})
