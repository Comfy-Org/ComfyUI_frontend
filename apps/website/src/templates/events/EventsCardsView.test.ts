// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import type { ComfyEvent } from '../../data/events'

import { directoryRows } from '../../utils/eventsDirectory'
import EventsCardsView from './EventsCardsView.vue'

const localized = (en: string) => ({ en, 'zh-CN': en })

const photoEvent: ComfyEvent = {
  id: 'photo',
  category: 'meetup',
  title: localized('Photo Meetup'),
  description: localized('A meetup with a photo.'),
  location: localized('Tokyo, Japan'),
  startDateTime: '2026-05-01T18:00:00Z',
  media: {
    type: 'image',
    src: 'https://example.com/photo.jpg',
    alt: localized('Photo art')
  }
}

const clipEvent: ComfyEvent = {
  id: 'clip',
  category: 'workshop',
  title: localized('Clip Workshop'),
  description: localized('A workshop with a looping clip.'),
  startDateTime: '2026-05-02T18:00:00Z',
  media: {
    type: 'video',
    src: 'https://example.com/clip.mp4',
    alt: localized('Clip art'),
    poster: 'https://example.com/poster.jpg'
  }
}

// A clock after the start dates keeps every fixture a past row, so the cards
// carry no interactive CTA and the media branches stay the thing under test.
const rowsFor = (events: ComfyEvent[]) =>
  directoryRows(events, 'en', new Date('2027-01-01T00:00:00Z'))

function mediaQueryList(matches: boolean): MediaQueryList {
  return Object.assign(new EventTarget(), {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addListener: () => {},
    removeListener: () => {}
  })
}

function renderCards(events: ComfyEvent[], reducedMotion: boolean) {
  vi.spyOn(window, 'matchMedia').mockReturnValue(mediaQueryList(reducedMotion))
  return render(EventsCardsView, { props: { rows: rowsFor(events) } })
}

// eslint-disable-next-line testing-library/no-node-access
const videoIn = (root: Element) => root.querySelector('video')

describe('EventsCardsView', () => {
  it('shows the empty message when no rows survive the filters', () => {
    render(EventsCardsView, { props: { rows: [] } })

    expect(
      screen.getByText(
        'No events match those filters yet. Try a broader search.'
      )
    ).toBeTruthy()
  })

  it('renders image art as a plain img', () => {
    const { container } = renderCards([photoEvent], false)

    expect(
      screen.getByRole('img', { name: 'Photo art' }).getAttribute('src')
    ).toBe('https://example.com/photo.jpg')
    expect(videoIn(container)).toBeNull()
  })

  it('autoplays video art for visitors without a motion preference', () => {
    const { container } = renderCards([clipEvent], false)

    const video = videoIn(container)
    expect(video?.getAttribute('src')).toBe('https://example.com/clip.mp4')
    expect(video?.hasAttribute('autoplay')).toBe(true)
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('shows the poster instead of the clip under reduced motion', () => {
    const { container } = renderCards([clipEvent], true)

    expect(
      screen.getByRole('img', { name: 'Clip art' }).getAttribute('src')
    ).toBe('https://example.com/poster.jpg')
    expect(videoIn(container)).toBeNull()
  })

  it('falls back to a stilled video under reduced motion without a poster', () => {
    const posterless: ComfyEvent = {
      ...clipEvent,
      media: {
        type: 'video',
        src: 'https://example.com/clip.mp4',
        alt: localized('Clip art')
      }
    }
    const { container } = renderCards([posterless], true)

    const video = videoIn(container)
    expect(video?.hasAttribute('autoplay')).toBe(false)
  })
})
