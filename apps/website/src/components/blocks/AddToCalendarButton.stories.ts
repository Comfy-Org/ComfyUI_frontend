import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'

import AddToCalendarButton from './AddToCalendarButton.vue'

const meta: Meta<typeof AddToCalendarButton> = {
  title: 'Website/Blocks/AddToCalendarButton',
  component: AddToCalendarButton,
  tags: ['autodocs', 'stable'],
  decorators: [
    () => ({
      template: '<div class="bg-primary-comfy-ink min-h-72 p-8"><story /></div>'
    })
  ],
  args: {
    portalDisabled: true,
    event: {
      title: 'ComfyUI Community Livestream',
      description: 'See new workflows and community projects.',
      location: 'https://comfy.org/events',
      start: new Date('2026-09-15T17:00:00.000Z'),
      end: new Date('2026-09-15T18:00:00.000Z')
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: /add to calendar/i })

    await userEvent.click(trigger)
    await expect(canvas.getByRole('menu')).toHaveAttribute('data-state', 'open')
    await expect(
      canvas.getByRole('menuitem', { name: /google/i })
    ).toHaveAttribute('href', expect.stringContaining('calendar.google.com'))
    await expect(
      canvas.getByRole('menuitem', { name: /apple/i })
    ).toHaveAttribute('download', 'comfyui-community-livestream.ics')
  }
}
