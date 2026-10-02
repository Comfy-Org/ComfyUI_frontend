import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Input from '@/components/ui/input/Input.vue'

import Label from './Label.vue'

const meta = {
  title: 'Components/Label',
  component: Label,
  tags: ['autodocs']
} satisfies Meta<typeof Label>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { Label, Input },
    template: `
      <div class="flex w-72 flex-col gap-2">
        <Label for="label-default">Email</Label>
        <Input id="label-default" placeholder="you@example.com" />
      </div>`
  })
}

export const Disabled: Story = {
  render: () => ({
    components: { Label, Input },
    template: `
      <div class="flex w-72 flex-col gap-2">
        <Input id="label-disabled" class="peer" placeholder="Disabled" disabled />
        <Label for="label-disabled">Peer-disabled label</Label>
      </div>`
  })
}
