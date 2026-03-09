import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { INodeSlot } from '@/lib/litegraph/src/interfaces'

import OutputSlot from './OutputSlot.vue'

function createSlotData(
  overrides: Partial<INodeSlot> = {}
): INodeSlot {
  return {
    name: 'IMAGE',
    type: 'IMAGE',
    boundingRect: [0, 0, 0, 0] as const,
    ...overrides
  }
}

const meta: Meta<typeof OutputSlot> = {
  title: 'VueNodes/OutputSlot',
  component: OutputSlot,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [
    (story) => ({
      components: { story },
      template: '<div class="w-48 bg-node-component-surface p-2"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    slotData: createSlotData({ name: 'IMAGE' }),
    index: 0
  }
}

export const WithLocalizedName: Story = {
  args: {
    slotData: createSlotData({
      name: 'IMAGE',
      localized_name: 'Imagen'
    }),
    index: 0
  }
}

export const WithLabel: Story = {
  args: {
    slotData: createSlotData({
      name: 'IMAGE',
      label: 'Custom Output'
    }),
    index: 0
  }
}

export const Connected: Story = {
  args: {
    slotData: createSlotData({ name: 'IMAGE' }),
    index: 0,
    connected: true
  }
}

export const Compatible: Story = {
  args: {
    slotData: createSlotData({ name: 'IMAGE' }),
    index: 0,
    compatible: true
  }
}

export const DotOnlyProp: Story = {
  args: {
    slotData: createSlotData({ name: 'IMAGE' }),
    index: 0,
    dotOnly: true
  }
}

export const DotOnlyDerived: Story = {
  name: 'Dot Only (empty name - reroute)',
  args: {
    slotData: createSlotData({ name: '' }),
    index: 0
  }
}

export const DotOnlyNoLocalizedName: Story = {
  name: 'Dot Only (empty name, no localized_name)',
  args: {
    slotData: createSlotData({
      name: '',
      localized_name: undefined
    }),
    index: 0
  }
}

export const DifferentTypes: Story = {
  render: () => ({
    components: { OutputSlot },
    setup() {
      const slots = [
        createSlotData({ name: 'IMAGE', type: 'IMAGE' }),
        createSlotData({ name: 'MODEL', type: 'MODEL' }),
        createSlotData({ name: 'CLIP', type: 'CLIP' }),
        createSlotData({ name: 'VAE', type: 'VAE' }),
        createSlotData({ name: 'LATENT', type: 'LATENT' }),
        createSlotData({ name: '*', type: '*' })
      ]
      return { slots }
    },
    template: `
      <div class="flex flex-col gap-1">
        <OutputSlot
          v-for="(slot, i) in slots"
          :key="i"
          :slot-data="slot"
          :index="i"
        />
      </div>
    `
  })
}
