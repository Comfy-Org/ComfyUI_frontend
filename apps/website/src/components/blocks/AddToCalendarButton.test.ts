// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { CalendarEvent } from '../../utils/calendar'
import AddToCalendarButton from './AddToCalendarButton.vue'

const event: CalendarEvent = {
  title: 'Comfy Meetup',
  description: 'An evening of workflows.',
  location: 'San Francisco',
  start: new Date('2026-10-01T18:00:00Z'),
  end: new Date('2026-10-01T20:00:00Z')
}

describe('AddToCalendarButton', () => {
  it('renders the localized default trigger', () => {
    render(AddToCalendarButton, { props: { event } })
    expect(screen.getByRole('button', { name: 'Add to calendar' })).toBeTruthy()
  })

  it('replaces the default trigger with the slot element and opens the menu from it', async () => {
    render(AddToCalendarButton, {
      props: { event },
      slots: { trigger: '<button type="button">Save the date?</button>' }
    })

    expect(screen.queryByText('Add to calendar')).toBeNull()

    await userEvent.click(
      screen.getByRole('button', { name: 'Save the date?' })
    )

    expect(
      await screen.findByRole('menuitem', { name: 'Google Calendar' })
    ).toBeTruthy()
    expect(
      screen.getByRole('menuitem', { name: 'Apple Calendar' })
    ).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Outlook' })).toBeTruthy()
  })
})
