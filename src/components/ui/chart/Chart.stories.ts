import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Chart from './Chart.vue'

const meta: Meta<typeof Chart> = {
  title: 'Components/Chart',
  component: Chart,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [
    (story) => ({
      components: { story },
      template: '<div class="w-[413px]"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Line: Story = {
  args: {
    type: 'line',
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
    type: 'line',
    ariaLabel: 'Line chart with multiple lines',
    data: {
      labels: ['A', 'B', 'C', 'D'],
      datasets: [
        { label: 'LineName1', data: [10, 45, 25, 80], tension: 0.4 },
        { label: 'LineName2', data: [80, 60, 40, 10], tension: 0.4 },
        { label: 'LineName3', data: [60, 70, 35, 40], tension: 0.4 }
      ]
    }
  }
}

export const Bar: Story = {
  args: {
    type: 'bar',
    ariaLabel: 'Bar chart with multiple datasets',
    data: {
      labels: ['A', 'B', 'C', 'D'],
      datasets: [
        { label: 'Series 1', data: [30, 60, 45, 80] },
        { label: 'Series 2', data: [50, 40, 70, 20] }
      ]
    }
  }
}
