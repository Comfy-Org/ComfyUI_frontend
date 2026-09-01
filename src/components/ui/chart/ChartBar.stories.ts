import type { Meta, StoryObj } from '@storybook/vue3-vite'

import ChartBar from './ChartBar.vue'

const meta: Meta<typeof ChartBar> = {
  title: 'Components/Chart/ChartBar',
  component: ChartBar,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [
    (story) => ({
      components: { story },
      template:
        '<div class="w-[413px] bg-neutral-900 p-4 rounded-lg"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    ariaLabel: 'Bar chart example',
    data: {
      labels: ['A', 'B', 'C', 'D'],
      datasets: [
        {
          label: 'BarName1',
          data: [10, 50, 35, 75],
          backgroundColor: '#ff8000'
        }
      ]
    }
  }
}

export const MultipleDatasets: Story = {
  args: {
    ariaLabel: 'Bar chart with multiple datasets',
    data: {
      labels: ['A', 'B', 'C', 'D'],
      datasets: [
        {
          label: 'Series 1',
          data: [30, 60, 45, 80],
          backgroundColor: '#ff8000'
        },
        {
          label: 'Series 2',
          data: [50, 40, 70, 20],
          backgroundColor: '#4ade80'
        }
      ]
    }
  }
}
