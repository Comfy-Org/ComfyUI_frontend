import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { PopoverArrow, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import Button from '@comfyorg/design-system/button/Button'

import PopoverContent from './PopoverContent.vue'

const meta: Meta<{
  contentClass: string
  rows: number
  wideContent: boolean
  arrow: boolean
}> = {
  title: 'Components/Popover',
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { contentClass: '', rows: 2, wideContent: false, arrow: false },
  render: (args) => ({
    components: {
      Button,
      PopoverArrow,
      PopoverContent,
      PopoverRoot,
      PopoverTrigger
    },
    setup: () => ({ args }),
    template: `
      <div class="flex gap-2 p-4">
        <PopoverRoot v-slot="{ close }">
          <PopoverTrigger as-child><Button>Open popover</Button></PopoverTrigger>
          <PopoverContent :class="args.contentClass" align="start" dismiss-on-viewport-change>
            <Button variant="textonly">First action</Button>
            <div :class="args.wideContent ? 'w-[200vw]' : ''">
              <p v-for="row in args.rows" :key="row" class="py-2">Popover item {{ row }}</p>
            </div>
            <Button @click="close">Last action</Button>
            <PopoverArrow v-if="args.arrow" class="fill-background stroke-border" />
          </PopoverContent>
        </PopoverRoot>
        <Button variant="secondary">Outside</Button>
      </div>
    `
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Open popover' }))
    await waitFor(() =>
      expect(
        within(canvasElement.ownerDocument.body).getByRole('dialog')
      ).toBeVisible()
    )
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Oversized: Story = {
  args: { contentClass: 'w-[200vw]', rows: 60, wideContent: true },
  play: async (context) => {
    await meta.play?.(context)
    const dialog = within(context.canvasElement.ownerDocument.body).getByRole(
      'dialog'
    )
    const viewport = context.canvasElement.ownerDocument.documentElement

    await waitFor(async () => {
      const bounds = dialog.getBoundingClientRect()
      await expect(bounds.left).toBeGreaterThanOrEqual(8)
      await expect(bounds.top).toBeGreaterThanOrEqual(8)
      await expect(bounds.right).toBeLessThanOrEqual(viewport.clientWidth - 8)
      await expect(bounds.bottom).toBeLessThanOrEqual(viewport.clientHeight - 8)
    })

    await userEvent.tab()
    const lastAction = within(dialog).getByRole('button', {
      name: 'Last action'
    })
    await expect(lastAction).toHaveFocus()
    await waitFor(async () => {
      await expect(dialog.scrollTop).toBeGreaterThan(0)
      await expect(
        lastAction.getBoundingClientRect().bottom
      ).toBeLessThanOrEqual(dialog.getBoundingClientRect().bottom)
    })
    dialog.scrollLeft = dialog.scrollWidth
    await waitFor(() => expect(dialog.scrollLeft).toBeGreaterThan(0))
    await expect(dialog).toBeVisible()
  }
}

export const CustomSizingWithArrow: Story = {
  args: {
    contentClass: 'w-96 max-h-48 max-w-64 overflow-visible',
    rows: 1,
    arrow: true
  },
  play: async (context) => {
    await meta.play?.(context)
    const dialog = within(context.canvasElement.ownerDocument.body).getByRole(
      'dialog'
    )
    await waitFor(async () => {
      await expect(dialog.getBoundingClientRect().width).toBe(256)
      await expect(getComputedStyle(dialog).maxHeight).toBe('192px')
      await expect(getComputedStyle(dialog).overflow).toBe('visible')
    })
  }
}
