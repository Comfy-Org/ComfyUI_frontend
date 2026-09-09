// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { ComfyEvent } from '../../data/events'
import type { DirectoryRow } from '../../utils/eventsDirectory'

import EventsDirectoryCta from './EventsDirectoryCta.vue'

const localized = (en: string) => ({ en, 'zh-CN': en })

const event: ComfyEvent = {
  id: 'paris',
  category: 'hackathon',
  title: localized('Paris Hack Night'),
  description: localized('Fifty builders, one night.'),
  startDateTime: '2026-07-04T18:00:00+02:00'
}

function makeRow(overrides: Partial<DirectoryRow>): DirectoryRow {
  return {
    event,
    upcoming: true,
    category: 'Hackathon',
    title: 'Paris Hack Night',
    description: 'Fifty builders, one night.',
    date: 'Jul 4, 2026',
    location: 'Paris, France',
    ...overrides
  }
}

const calendar = {
  title: 'Paris Hack Night',
  description: 'Fifty builders, one night.',
  location: 'Paris, France',
  start: new Date('2026-07-04T16:00:00Z'),
  end: new Date('2026-07-04T17:00:00Z')
}

describe('EventsDirectoryCta', () => {
  it('offers the save-the-date menu on an upcoming row', () => {
    render(EventsDirectoryCta, { props: { row: makeRow({ calendar }) } })

    expect(screen.getByRole('button', { name: 'Save the date?' })).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('adds the registration link beside the calendar menu', () => {
    const row = makeRow({
      calendar,
      register: {
        href: 'https://example.com/register',
        newTab: true,
        label: 'Register'
      }
    })
    render(EventsDirectoryCta, { props: { row } })

    expect(screen.getByRole('button', { name: 'Save the date?' })).toBeTruthy()
    const link = screen.getByRole('link', { name: 'Register' })
    expect(link.getAttribute('href')).toBe('https://example.com/register')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('links a past row to its recording', () => {
    const row = makeRow({
      upcoming: false,
      watch: { href: '/events/paris', newTab: false, label: 'WATCH NOW' }
    })
    render(EventsDirectoryCta, { props: { row } })

    const link = screen.getByRole('link', { name: 'WATCH NOW' })
    expect(link.getAttribute('href')).toBe('/events/paris')
    expect(link.getAttribute('target')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
