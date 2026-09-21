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
  it('renders the title and description', () => {
    render(CustomerWatchPage, {
      props: { story: blackMath },
      global: { stubs }
    })

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      blackMath.title
    )
    expect(screen.getByText(blackMath.description)).toBeTruthy()
  })

  it('passes the story media to the video player', () => {
    render(CustomerWatchPage, {
      props: { story: blackMath },
      global: { stubs }
    })

    expect(screen.getByTestId('video-player').dataset.src).toBe(
      blackMath.videoSrc
    )
  })

  it('omits the transcript section when no transcript is passed', () => {
    render(CustomerWatchPage, {
      props: { story: blackMath },
      global: { stubs }
    })

    expect(screen.queryByText('Transcript')).toBeNull()
  })

  it('renders every transcript paragraph when one is passed', () => {
    render(CustomerWatchPage, {
      props: {
        story: blackMath,
        transcript: ['First paragraph.', 'Second paragraph.']
      },
      global: { stubs }
    })

    expect(screen.getByText('Transcript')).toBeTruthy()
    expect(screen.getByText('First paragraph.')).toBeTruthy()
    expect(screen.getByText('Second paragraph.')).toBeTruthy()
  })

  it('omits the duration caption when the story has no verified duration', () => {
    render(CustomerWatchPage, {
      props: { story: blackMath },
      global: { stubs }
    })

    expect(screen.queryByText(/^\d+:\d{2}$/)).toBeNull()
  })

  it('shows the duration caption once the story has a verified duration', () => {
    render(CustomerWatchPage, {
      props: { story: { ...blackMath, durationSeconds: 272 } },
      global: { stubs }
    })

    expect(screen.getByText('4:32')).toBeTruthy()
  })

  it('shows the reciprocal written-story link only when one is given', () => {
    const { rerender } = render(CustomerWatchPage, {
      props: { story: silverside },
      global: { stubs }
    })
    expect(screen.queryByText('Read the written story')).toBeNull()

    return rerender({
      story: silverside,
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
      props: { story: blackMath },
      global: { stubs }
    })

    expect(
      screen.getByRole('link', { name: 'BROWSE ALL CUSTOMER STORIES' })
    ).toHaveProperty('href', expect.stringContaining('/customers'))
  })
})
