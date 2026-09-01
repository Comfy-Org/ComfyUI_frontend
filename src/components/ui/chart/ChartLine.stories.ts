import type { Meta, StoryObj } from '@storybook/vue3-vite'

import ChartLine from './ChartLine.vue'

const meta: Meta<typeof ChartLine> = {
  title: 'Components/Chart/ChartLine',
  component: ChartLine,
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
    ariaLabel: 'Line chart example',
    data: {
      labels: ['A', 'B', 'C', 'D'],
      datasets: [
        {
          label: 'LineName1',
          data: [10, 45, 25, 80],
          borderColor: '#4ade80',
          borderDash: [5, 5],
          fill: true,
          backgroundColor: '#4ade8033',
          tension: 0.4
        }
      ]
    }
  }
}

export const MultipleLines: Story = {
  args: {
    ariaLabel: 'Line chart with multiple lines',
    data: {
      labels: ['A', 'B', 'C', 'D'],
      datasets: [
        {
          label: 'LineName1',
          data: [10, 45, 25, 80],
          borderColor: '#4ade80',
          borderDash: [5, 5],
          fill: true,
          backgroundColor: '#4ade8033',
          tension: 0.4
        },
        {
          label: 'LineName2',
          data: [80, 60, 40, 10],
          borderColor: '#ff8000',
          fill: true,
          backgroundColor: '#ff800033',
          tension: 0.4
        },
        {
          label: 'LineName3',
          data: [60, 70, 35, 40],
          borderColor: '#ef4444',
          fill: true,
          backgroundColor: '#ef444433',
          tension: 0.4
        }
      ]
    }
  }
}
