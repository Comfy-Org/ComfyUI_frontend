import type {
  ComponentPropsAndSlots,
  Meta,
  StoryObj
} from '@storybook/vue3-vite'
import { expect, waitFor, within } from 'storybook/test'

import Button from './button/Button.vue'
import Popover from './Popover.vue'

const meta: Meta<ComponentPropsAndSlots<typeof Popover>> = {
  title: 'Components/Popover',
  component: Popover,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    showArrow: true,
    default: 'Adjust the workflow inputs before running.'
  },
  argTypes: {
    default: { control: 'text' },
    button: { control: false },
    to: { control: false }
  },
  render: (args) => ({
    components: { Popover, Button },
    setup: () => ({ args }),
    template: `
      <Popover
        :show-arrow="args.showArrow"
        :to="args.to"
      >
        <template #button>
          <Button variant="secondary">Open popover</Button>
        </template>
        <template #default="{ close }">
          <div class="flex w-64 flex-col gap-3">
            <p class="m-0 text-sm text-base-foreground">{{ args.default }}</p>
            <Button variant="secondary" @click="close()">Close</Button>
          </div>
        </template>
      </Popover>
    `
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    const body = within(canvasElement.ownerDocument.body)
    const trigger = canvas.getByRole('button', { name: 'Open popover' })
    const content = body.queryByRole('dialog', { name: 'Open popover' })
    await expect(content).not.toBeInTheDocument()
    await userEvent.click(trigger)
    await waitFor(() =>
      expect(body.getByRole('dialog', { name: 'Open popover' })).toBeVisible()
    )
    await userEvent.click(body.getByRole('button', { name: 'Close' }))
    await waitFor(async () => {
      await expect(
        body.queryByRole('dialog', { name: 'Open popover' })
      ).not.toBeInTheDocument()
      await expect(trigger).toHaveFocus()
    })
    await userEvent.click(trigger)
    await waitFor(() =>
      expect(body.getByRole('dialog', { name: 'Open popover' })).toBeVisible()
    )
    await userEvent.keyboard('{Escape}')
    await waitFor(async () => {
      await expect(
        body.queryByRole('dialog', { name: 'Open popover' })
      ).not.toBeInTheDocument()
      await expect(trigger).toHaveFocus()
    })
  }
}

export const Open: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open popover' }))
    await waitFor(() =>
      expect(
        within(canvasElement.ownerDocument.body).getByRole('dialog', {
          name: 'Open popover'
        })
      ).toBeVisible()
    )
  }
}

export const Confirmation: Story = {
  args: { default: 'Remove this input from the app?' },
  render: (args) => ({
    components: { Popover, Button },
    setup: () => ({ args }),
    template: `
      <Popover
        :show-arrow="args.showArrow"
        :to="args.to"
      >
        <template #button>
          <Button variant="secondary">Remove input</Button>
        </template>
        <template #default="{ close }">
          <div class="flex w-64 flex-col gap-3">
            <p class="m-0 text-sm text-base-foreground">{{ args.default }}</p>
            <div class="flex justify-end gap-2">
              <Button variant="secondary" @click="close()">Cancel</Button>
              <Button variant="destructive" @click="close()">Remove</Button>
            </div>
          </div>
        </template>
      </Popover>
    `
  }),
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Remove input' }))
    await waitFor(() =>
      expect(
        within(canvasElement.ownerDocument.body).getByRole('dialog', {
          name: 'Remove input'
        })
      ).toBeVisible()
    )
  }
}
