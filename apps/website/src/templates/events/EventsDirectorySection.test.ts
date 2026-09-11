// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type { ComfyEvent } from '../../data/events'
import type * as eventsModule from '../../data/events'

import EventsDirectorySection from './EventsDirectorySection.vue'

// Three fixtures against a fixed clock: an upcoming hackathon and a past
// meetup with coordinates, plus a virtual workshop without any.
const { NOW, fixtureEvents } = vi.hoisted(() => {
  const localized = (en: string) => ({ en, 'zh-CN': en })
  const paris: ComfyEvent = {
    id: 'paris',
    category: 'hackathon',
    organizer: 'partner',
    coords: { lat: 48.8566, lng: 2.3522 },
    title: localized('Paris Hack Night'),
    description: localized('Fifty builders, one night.'),
    location: localized('Paris, France'),
    startDateTime: '2026-07-04T18:00:00+02:00'
  }
  const tokyo: ComfyEvent = {
    id: 'tokyo',
    category: 'meetup',
    organizer: 'comfy',
    coords: { lat: 35.6762, lng: 139.6503 },
    title: localized('Tokyo Meetup'),
    description: localized('Monthly meetup.'),
    location: localized('Tokyo, Japan'),
    startDateTime: '2026-05-01T18:00:00+09:00',
    recordingVideoId: 'vid123'
  }
  const online: ComfyEvent = {
    id: 'online',
    category: 'workshop',
    organizer: 'community',
    title: localized('Online Node Workshop'),
    description: localized('From empty folder to node.'),
    startDateTime: '2026-06-20T17:00:00Z'
  }
  return {
    NOW: new Date('2026-06-01T00:00:00Z'),
    fixtureEvents: [paris, online, tokyo]
  }
})

vi.mock(import('../../data/events'), async (importOriginal) => {
  const actual = await importOriginal<typeof eventsModule>()
  return { ...actual, directoryEvents: fixtureEvents, eventsDerivedAt: NOW }
})

// The real map pulls in Leaflet at mount, so it is replaced with one button
// per marker that replays the block's `select` event.
const stubs = {
  MapPins01: {
    props: ['markers'],
    emits: ['select'],
    template: `
      <div data-testid="map-stub">
        <button
          v-for="marker in markers"
          :key="marker.id"
          type="button"
          :data-marker-id="marker.id"
          @click="$emit('select', marker.id)"
        >{{ marker.label }}</button>
      </div>
    `
  }
}

function renderSection() {
  return render(EventsDirectorySection, {
    props: { locale: 'en' },
    global: { stubs }
  })
}

const rowFor = (title: string) =>
  screen
    .queryAllByTestId('events-directory-row')
    .find((row) => within(row).queryByText(title) !== null)

describe('EventsDirectorySection', () => {
  it('maps only the events that have coordinates', () => {
    renderSection()

    const pins = within(screen.getByTestId('map-stub')).getAllByRole('button')
    expect(pins.map((pin) => pin.getAttribute('data-marker-id'))).toEqual([
      'paris',
      'tokyo'
    ])
  })

  it('switches the count label between plural and singular forms', async () => {
    renderSection()
    expect(screen.getByText('3 events')).toBeTruthy()

    await userEvent.type(screen.getByRole('searchbox'), 'paris')
    await nextTick()

    expect(screen.getByText('1 event')).toBeTruthy()
  })

  it('reverses the list when sorting by oldest', async () => {
    renderSection()

    const titles = () =>
      screen
        .queryAllByTestId('events-directory-row')
        .map((row) => within(row).getByRole('heading').textContent.trim())

    expect(titles()[0]).toBe('Paris Hack Night')

    await userEvent.selectOptions(
      screen.getByLabelText('Sort events'),
      'oldest'
    )
    await nextTick()

    expect(titles()[0]).toBe('Tokyo Meetup')

    await userEvent.selectOptions(
      screen.getByLabelText('Sort events'),
      'latest'
    )
    await nextTick()

    expect(titles()[0]).toBe('Paris Hack Night')
  })

  it('hides sorting in the calendar view, which owns its chronology', async () => {
    renderSection()
    expect(screen.getByLabelText('Sort events')).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: 'Calendar' }))
    await nextTick()

    expect(screen.queryByLabelText('Sort events')).toBeNull()
  })

  it('keeps the filters across view switches', async () => {
    renderSection()

    await userEvent.type(screen.getByRole('searchbox'), 'meetup')
    await userEvent.selectOptions(screen.getByLabelText('Event type'), 'meetup')
    await nextTick()

    await userEvent.click(screen.getByRole('button', { name: 'Cards' }))
    await nextTick()
    expect(screen.getByText('Tokyo Meetup')).toBeTruthy()
    expect(screen.queryByText('Paris Hack Night')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Calendar' }))
    await nextTick()
    expect(screen.getByText('Tokyo Meetup')).toBeTruthy()
    expect(screen.queryByText('Paris Hack Night')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Map' }))
    await nextTick()
    expect(screen.getByText('1 event')).toBeTruthy()
    const search = screen.getByRole('searchbox')
    expect(search instanceof HTMLInputElement && search.value).toBe('meetup')
  })

  it('drops the pin selection when the selected event is filtered out', async () => {
    renderSection()
    const map = screen.getByTestId('map-stub')

    await userEvent.click(
      within(map).getByRole('button', { name: 'Paris Hack Night' })
    )
    await nextTick()
    expect(rowFor('Paris Hack Night')?.getAttribute('aria-current')).toBe(
      'true'
    )

    await userEvent.type(screen.getByRole('searchbox'), 'tokyo')
    await nextTick()

    expect(rowFor('Paris Hack Night')).toBeUndefined()
    expect(rowFor('Tokyo Meetup')?.getAttribute('aria-current')).toBeNull()

    // Restoring the filter must not resurrect the old pin selection.
    await userEvent.clear(screen.getByRole('searchbox'))
    await nextTick()

    expect(rowFor('Paris Hack Night')?.getAttribute('aria-current')).toBeNull()
  })
})
