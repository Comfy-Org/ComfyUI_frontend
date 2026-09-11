// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type { ComfyEvent } from '../../data/events'
import type * as eventsModule from '../../data/events'

import PastEventsSection from './PastEventsSection.vue'

// Five past fixtures — one more than PAST_EVENTS_PAGE_SIZE, so the gallery has to
// paginate: a recorded livestream with image art, a recorded meetup with video
// art, an unrecorded workshop with no art whose only destination is its
// external page, an untranslated conference, and a destinationless meetup with
// neither a recording nor a link.
const { fixturePastEvents } = vi.hoisted(() => {
  const localized = (en: string) => ({ en, 'zh-CN': en })
  const recorded: ComfyEvent = {
    id: 'recorded-livestream',
    category: 'livestream',
    title: localized('Recorded Livestream'),
    description: localized('A stream with a recording.'),
    startDateTime: '2026-01-10T18:00:00Z',
    recordingVideoId: 'vid123',
    media: {
      type: 'image',
      src: 'https://example.com/livestream.jpg',
      alt: localized('Livestream art')
    }
  }
  const clip: ComfyEvent = {
    id: 'clip-meetup',
    category: 'meetup',
    title: localized('Clip Meetup'),
    description: localized('A meetup with a looping clip.'),
    startDateTime: '2026-02-01T18:00:00Z',
    recordingVideoId: 'vid456',
    media: {
      type: 'video',
      src: 'https://example.com/meetup.mp4',
      alt: localized('Meetup clip'),
      poster: 'https://example.com/meetup-poster.jpg'
    }
  }
  const artless: ComfyEvent = {
    id: 'artless-workshop',
    category: 'workshop',
    title: localized('Artless Workshop'),
    description: localized('No recording, no card art.'),
    startDateTime: '2026-03-01T18:00:00Z',
    link: { href: localized('https://example.com/workshop'), newTab: true }
  }
  const untranslated: ComfyEvent = {
    id: 'untranslated-conference',
    category: 'conference',
    title: { en: 'English-Only Conference', 'zh-CN': '' },
    description: { en: 'Not yet translated.', 'zh-CN': '' },
    startDateTime: '2026-04-01T18:00:00Z',
    link: {
      href: { en: 'https://example.com/conf', 'zh-CN': '' },
      newTab: true
    },
    media: {
      type: 'image',
      src: 'https://example.com/conf.jpg',
      alt: { en: 'Conference art', 'zh-CN': '' }
    }
  }
  const destinationless: ComfyEvent = {
    id: 'destinationless-meetup',
    category: 'meetup',
    title: localized('Destinationless Meetup'),
    description: localized('Neither a recording nor a link.'),
    startDateTime: '2026-05-01T18:00:00Z'
  }
  return {
    fixturePastEvents: [recorded, clip, artless, untranslated, destinationless]
  }
})

vi.mock(import('../../data/events'), async (importOriginal) => {
  const actual = await importOriginal<typeof eventsModule>()
  return { ...actual, pastEvents: fixturePastEvents }
})

describe('PastEventsSection', () => {
  it('renders a card for every past event, artless ones included', () => {
    render(PastEventsSection)

    expect(screen.getByText('Recorded Livestream')).toBeTruthy()
    expect(screen.getByText('Clip Meetup')).toBeTruthy()
    expect(screen.getByText('Artless Workshop')).toBeTruthy()
  })

  it('sends a recorded event to its own page under a WATCH NOW label', () => {
    render(PastEventsSection)

    const link = screen.getByRole('link', {
      name: 'Recorded Livestream — WATCH NOW'
    })
    expect(link.getAttribute('href')).toBe('/events/recorded-livestream')
    expect(link.getAttribute('target')).toBeNull()
  })

  it('links an unrecorded event out under LEARN MORE in a new tab', () => {
    render(PastEventsSection)

    const link = screen.getByRole('link', {
      name: 'Artless Workshop — LEARN MORE'
    })
    expect(link.getAttribute('href')).toBe('https://example.com/workshop')
    expect(link.getAttribute('target')).toBe('_blank')
  })

  it('falls back to English title, art alt, and link for untranslated events', () => {
    render(PastEventsSection, { props: { locale: 'zh-CN' } })

    const link = screen.getByRole('link', {
      name: 'English-Only Conference — 了解更多'
    })
    expect(link.getAttribute('href')).toBe('https://example.com/conf')
    expect(screen.getByRole('img', { name: 'Conference art' })).toBeTruthy()
  })

  it('offers a filter tab only for categories that have a card', () => {
    render(PastEventsSection)

    expect(screen.getByRole('button', { name: /^ALL \d+$/ })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /^LIVESTREAM \d+$/ })
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: /^WORKSHOP \d+$/ })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /^CONFERENCE \d+$/ })
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^HACKATHON/ })).toBeNull()
  })

  it('narrows the cards to a tab category and restores them via ALL', async () => {
    render(PastEventsSection)

    await userEvent.click(
      screen.getByRole('button', { name: /^WORKSHOP \d+$/ })
    )
    await nextTick()

    expect(screen.getByText('Artless Workshop')).toBeTruthy()
    expect(screen.queryByText('Recorded Livestream')).toBeNull()
    expect(screen.queryByText('Clip Meetup')).toBeNull()
    expect(screen.queryByText('English-Only Conference')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: /^ALL \d+$/ }))
    await nextTick()

    expect(screen.getByText('Artless Workshop')).toBeTruthy()
    expect(screen.getByText('Recorded Livestream')).toBeTruthy()
    expect(screen.getByText('Clip Meetup')).toBeTruthy()
    expect(screen.getByText('English-Only Conference')).toBeTruthy()
  })

  it('holds the overflowing card behind LOAD MORE and gives it no CTA', async () => {
    render(PastEventsSection)

    // PAST_EVENTS_PAGE_SIZE is 4, so the fifth fixture waits behind the button.
    expect(screen.queryByText('Destinationless Meetup')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'LOAD MORE' }))
    await nextTick()

    expect(screen.getByText('Destinationless Meetup')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'LOAD MORE' })).toBeNull()
    // Neither a recording nor a link, so the card must not link anywhere.
    expect(
      screen.queryByRole('link', { name: /Destinationless Meetup/ })
    ).toBeNull()
  })

  it('passes each card its own art, poster included for clips', () => {
    const { container } = render(PastEventsSection)

    expect(
      screen.getByRole('img', { name: 'Livestream art' }).getAttribute('src')
    ).toBe('https://example.com/livestream.jpg')
    // <video> has no queryable role in happy-dom, so reach it directly.
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const clip = container.querySelector('video')
    expect(clip?.getAttribute('src')).toBe('https://example.com/meetup.mp4')
    expect(clip?.getAttribute('poster')).toBe(
      'https://example.com/meetup-poster.jpg'
    )
  })
})
