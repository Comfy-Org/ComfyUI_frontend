// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type * as vueuseModule from '@vueuse/core'

import type { ComfyEvent } from '../../data/events'

import { directoryRows } from '../../utils/eventsDirectory'
import EventsDirectoryRow from './EventsDirectoryRow.vue'

const localized = (en: string) => ({ en, 'zh-CN': en })

// Captures the resize callback so a test can feed it a fake overflow entry;
// happy-dom performs no layout, so the clamp can never trip on its own.
const { resizeCallbacks } = vi.hoisted(() => ({
  resizeCallbacks: [] as Array<(entries: Array<{ target: Element }>) => void>
}))
vi.mock(import('@vueuse/core'), async (importOriginal) => {
  const actual = await importOriginal<typeof vueuseModule>()
  return {
    ...actual,
    useResizeObserver: vi.fn((_el: unknown, cb: unknown) => {
      resizeCallbacks.push(cb as (typeof resizeCallbacks)[number])
      return { stop: () => {} }
    }) as unknown as typeof actual.useResizeObserver
  }
})

const makeEvent = (overrides: Partial<ComfyEvent> = {}): ComfyEvent => ({
  id: 'meetup-1',
  category: 'meetup',
  title: localized('A Meetup'),
  description: localized('A description that could run long.'),
  location: localized('Somewhere'),
  startDateTime: '2026-05-01T18:00:00Z',
  ...overrides
})

const rowOf = (event: ComfyEvent, now: Date) =>
  directoryRows([event], 'en', now)[0]

const AFTER = new Date('2027-01-01T00:00:00Z')
const BEFORE = new Date('2026-01-01T00:00:00Z')

describe('EventsDirectoryRow', () => {
  it('marks past rows with a Past pill and leaves upcoming rows without one', () => {
    const { unmount } = render(EventsDirectoryRow, {
      props: { row: rowOf(makeEvent(), AFTER) }
    })
    expect(screen.getByText('Past')).toBeTruthy()
    unmount()

    render(EventsDirectoryRow, { props: { row: rowOf(makeEvent(), BEFORE) } })
    expect(screen.queryByText('Past')).toBeNull()
  })

  it('overlays a link to the watch page on a recorded past row', () => {
    const row = rowOf(makeEvent({ recordingVideoId: 'vid123' }), AFTER)
    render(EventsDirectoryRow, { props: { row } })

    const overlay = screen
      .getAllByRole('link')
      .find((el) => el.getAttribute('aria-label')?.includes('A Meetup'))
    expect(overlay?.getAttribute('href')).toContain('/events/meetup-1')
  })

  it('derives an upcoming livestream link from its liveVideoId', () => {
    const row = rowOf(
      makeEvent({
        id: 'stream-1',
        category: 'livestream',
        liveVideoId: 'abc123'
      }),
      BEFORE
    )
    render(EventsDirectoryRow, { props: { row } })

    const hrefs = screen
      .getAllByRole('link')
      .map((el) => el.getAttribute('href'))
    expect(hrefs).toContain('https://www.youtube.com/watch?v=abc123')
  })

  it('renders no overlay for an upcoming row without a destination', () => {
    render(EventsDirectoryRow, { props: { row: rowOf(makeEvent(), BEFORE) } })
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('reveals Read more only when the clamp cuts the description off', async () => {
    render(EventsDirectoryRow, { props: { row: rowOf(makeEvent(), AFTER) } })

    expect(screen.queryByRole('button', { name: 'Read more' })).toBeNull()

    const desc = screen.getByText('A description that could run long.')
    Object.defineProperty(desc, 'scrollHeight', { value: 64 })
    Object.defineProperty(desc, 'clientHeight', { value: 32 })
    for (const cb of resizeCallbacks) cb([{ target: desc }])
    await nextTick()

    await userEvent.click(screen.getByRole('button', { name: 'Read more' }))
    expect(screen.getByRole('button', { name: 'Read less' })).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: 'Read less' }))
    expect(screen.getByRole('button', { name: 'Read more' })).toBeTruthy()
  })
})
