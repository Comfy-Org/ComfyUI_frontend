// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyEvent } from '../../utils/events'
import UpcomingEventsSection from './UpcomingEventsSection.vue'

const baseEvent: ComfyEvent = {
  id: 'base',
  category: 'community',
  title: 'Base',
  description: 'A base event.',
  locationMode: 'online',
  startDateTime: '2026-08-10T00:00:00Z'
}

const eventAt = (id: string, startDateTime: string): ComfyEvent => ({
  ...baseEvent,
  id,
  title: id,
  startDateTime
})

describe('UpcomingEventsSection', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders only the events still upcoming at the given time', async () => {
    const now = '2026-08-10T00:00:00Z'
    vi.setSystemTime(new Date(now))
    const events = [
      eventAt('upcoming', '2026-08-15T10:00:00-07:00'),
      eventAt('finished', '2026-08-01T10:00:00-07:00')
    ]

    render(UpcomingEventsSection, { props: { events, now, locale: 'en' } })

    await waitFor(() => {
      expect(screen.getByText('upcoming')).toBeTruthy()
    })
    expect(screen.queryByText('finished')).toBeNull()
  })

  it('reconciles the split against the client clock after mount', async () => {
    const buildNow = '2026-08-14T00:00:00Z'
    // The client renders well past the event's end, though the build-time
    // default still placed it in the upcoming list.
    vi.setSystemTime(new Date('2026-08-20T00:00:00Z'))
    const events = [eventAt('just-ended', '2026-08-15T10:00:00-07:00')]

    render(UpcomingEventsSection, {
      props: { events, now: buildNow, locale: 'en' }
    })

    await waitFor(() => {
      expect(screen.queryByText('just-ended')).toBeNull()
    })
  })
})
