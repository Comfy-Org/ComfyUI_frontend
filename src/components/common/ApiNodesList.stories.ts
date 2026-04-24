import type { Meta, StoryObj } from '@storybook/vue3-vite'

import ApiNodesList from './ApiNodesList.vue'

const meta = {
  title: 'Components/Lists/ApiNodesList',
  component: ApiNodesList,
  tags: ['autodocs'],
  decorators: [
    () => ({
      template:
        '<div class="h-80 w-96 p-4 bg-(--p-content-background)"><story /></div>'
    })
  ],
  args: {
    nodes: [
      { id: 1, name: 'OpenAIChatNode', cost: '10 credits/Run' },
      { id: 2, name: 'FluxProNode', cost: '~5-15 credits/Run' },
      { id: 3, name: 'StabilityImageNode', cost: '20 credits/Run' }
    ],
    total: { label: '~35-45 credits' }
  }
} satisfies Meta<typeof ApiNodesList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const NamesOnly: Story = {
  args: {
    nodes: [
      { id: 1, name: 'OpenAIChatNode', cost: null },
      { id: 2, name: 'FluxProNode', cost: null }
    ],
    total: null
  }
}

export const SingleValueTotal: Story = {
  args: {
    nodes: [
      { id: 1, name: 'OpenAIChatNode', cost: '10 credits/Run' },
      { id: 2, name: 'StabilityImageNode', cost: '20 credits/Run' }
    ],
    total: { label: '30 credits' }
  }
}

export const RangeTotal: Story = {
  args: {
    nodes: [
      { id: 1, name: 'FluxProNode', cost: '~5-15 credits/Run' },
      { id: 2, name: 'HailuoVideoNode', cost: '~50-100 credits/Run' }
    ],
    total: { label: '~55-115 credits' }
  }
}

export const SingleNode: Story = {
  args: {
    nodes: [{ id: 1, name: 'OpenAIChatNode', cost: '10 credits/Run' }],
    total: { label: '10 credits' }
  }
}

export const LongList: Story = {
  args: {
    nodes: Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      name: `ApiNodeExample${i + 1}`,
      cost: `${(i + 1) * 5} credits/Run`
    })),
    total: { label: '390 credits' }
  }
}
