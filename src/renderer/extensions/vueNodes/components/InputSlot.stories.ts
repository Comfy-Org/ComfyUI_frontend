import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { INodeSlot } from '@/lib/litegraph/src/interfaces'

import InputSlot from './InputSlot.vue'

function createSlotData(overrides: Partial<INodeSlot> = {}): INodeSlot {
  return {
    name: 'image',
    type: 'IMAGE',
    boundingRect: [0, 0, 0, 0] as const,
    ...overrides
  }
}

const meta: Meta<typeof InputSlot> = {
  title: 'VueNodes/InputSlot',
  component: InputSlot,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [
    (story) => ({
      components: { story },
      template:
        '<div class="w-48 bg-node-component-surface p-2"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    slotData: createSlotData({ name: 'image' }),
    index: 0
  }
}

export const WithLocalizedName: Story = {
  args: {
    slotData: createSlotData({
      name: 'image',
      localized_name: 'Imagen'
    }),
    index: 0
  }
}

export const WithLabel: Story = {
  args: {
    slotData: createSlotData({
      name: 'image',
      label: 'Custom Label'
    }),
    index: 0
  }
}

export const Connected: Story = {
  args: {
    slotData: createSlotData({ name: 'model' }),
    index: 0,
    connected: true
  }
}

export const Compatible: Story = {
  args: {
    slotData: createSlotData({ name: 'model' }),
    index: 0,
    compatible: true
  }
}

export const WithError: Story = {
  args: {
    slotData: createSlotData({ name: 'image' }),
    index: 0,
    hasError: true
  }
}

export const DotOnlyProp: Story = {
  args: {
    slotData: createSlotData({ name: 'image' }),
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
    components: { InputSlot },
    setup() {
      const slots = [
        createSlotData({ name: 'model', type: 'MODEL' }),
        createSlotData({ name: 'clip', type: 'CLIP' }),
        createSlotData({ name: 'vae', type: 'VAE' }),
        createSlotData({ name: 'latent', type: 'LATENT' }),
        createSlotData({ name: 'anything', type: '*' })
      ]
      return { slots }
    },
    template: `
      <div class="flex flex-col gap-1">
        <InputSlot
          v-for="(slot, i) in slots"
          :key="i"
          :slot-data="slot"
          :index="i"
        />
      </div>
    `
  })
}
