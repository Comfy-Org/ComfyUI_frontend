// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type { ComfyEvent } from '../../data/events'

import { directoryRows } from '../../utils/eventsDirectory'
import EventsDirectoryList from './EventsDirectoryList.vue'

const localized = (en: string) => ({ en, 'zh-CN': en })

const makeEvent = (id: string, title: string): ComfyEvent => ({
  id,
  category: 'meetup',
  title: localized(title),
  description: localized('A description.'),
  location: localized('Somewhere'),
  startDateTime: '2026-05-01T18:00:00Z'
})

// A clock after the start dates: past rows carry no interactive CTA, keeping
// the list itself the only thing under test.
const rows = directoryRows(
  [makeEvent('paris', 'Paris Hack Night'), makeEvent('tokyo', 'Tokyo Meetup')],
  'en',
  new Date('2027-01-01T00:00:00Z')
)

function mediaQueryList(matches: boolean): MediaQueryList {
  return Object.assign(new EventTarget(), {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addListener: () => {},
    removeListener: () => {}
  })
}

async function selectRow(id: string) {
  const view = render(EventsDirectoryList, {
    props: { rows, selectedEventId: null }
  })
  await view.rerender({ rows, selectedEventId: id })
  // The component defers the scroll one tick past the selection change.
  await nextTick()
  await nextTick()
}

describe('EventsDirectoryList', () => {
  it('renders a row per event', () => {
    render(EventsDirectoryList, { props: { rows } })

    expect(screen.getByText('Paris Hack Night')).toBeTruthy()
    expect(screen.getByText('Tokyo Meetup')).toBeTruthy()
  })

  it('shows the empty message when no rows survive the filters', () => {
    render(EventsDirectoryList, { props: { rows: [] } })

    expect(
      screen.getByText(
        'No events match those filters yet. Try a broader search.'
      )
    ).toBeTruthy()
  })

  it('scrolls the selected row into view smoothly by default', async () => {
    const scrollIntoView = vi
      .spyOn(Element.prototype, 'scrollIntoView')
      .mockImplementation(() => {})
    vi.spyOn(window, 'matchMedia').mockReturnValue(mediaQueryList(false))

    await selectRow('tokyo')

    expect(scrollIntoView).toHaveBeenCalledWith({
      block: 'nearest',
      behavior: 'smooth'
    })
    const target = scrollIntoView.mock.contexts.at(-1)
    expect(
      target instanceof Element && target.getAttribute('data-event-id')
    ).toBe('tokyo')
  })

  it('scrolls to a row selected before the list mounted', async () => {
    const scrollIntoView = vi
      .spyOn(Element.prototype, 'scrollIntoView')
      .mockImplementation(() => {})
    vi.spyOn(window, 'matchMedia').mockReturnValue(mediaQueryList(false))

    render(EventsDirectoryList, {
      props: { rows, selectedEventId: 'paris' }
    })
    await nextTick()
    await nextTick()

    expect(scrollIntoView).toHaveBeenCalledWith({
      block: 'nearest',
      behavior: 'smooth'
    })
    const target = scrollIntoView.mock.contexts.at(-1)
    expect(
      target instanceof Element && target.getAttribute('data-event-id')
    ).toBe('paris')
  })

  it('scrolls without animation when the visitor prefers reduced motion', async () => {
    const scrollIntoView = vi
      .spyOn(Element.prototype, 'scrollIntoView')
      .mockImplementation(() => {})
    vi.spyOn(window, 'matchMedia').mockReturnValue(mediaQueryList(true))

    await selectRow('paris')

    expect(scrollIntoView).toHaveBeenCalledWith({
      block: 'nearest',
      behavior: 'auto'
    })
  })
})
