import type { Meta, StoryObj } from '@storybook/vue3-vite'

import CardBottom from './CardBottom.vue'
import CardContainer from './CardContainer.vue'
import CardGridList from './CardGridList.vue'
import CardTop from './CardTop.vue'

const meta: Meta<typeof CardGridList> = {
  title: 'Components/Card/CardGridList',
  component: CardGridList,
  tags: ['autodocs'],
  argTypes: {
    minWidth: {
      control: 'text',
      description: 'Minimum width for each grid item'
    },
    maxWidth: {
      control: 'text',
      description: 'Maximum width for each grid item'
    },
    padding: {
      control: 'text',
      description: 'Padding around the grid'
    },
    gap: {
      control: 'text',
      description: 'Gap between grid items'
    },
    columns: {
      control: 'number',
      description: 'Fixed number of columns (overrides auto-fill)'
    }
  },
  args: {
    minWidth: '15rem',
    maxWidth: '1fr',
    padding: '0rem',
    gap: '1rem'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => ({
    components: { CardGridList, CardContainer, CardTop, CardBottom },
    setup() {
      return { args }
    },
    template: `
      <CardGridList v-bind="args">
        <CardContainer v-for="i in 12" :key="i" ratio="square">
          <template #top>
            <CardTop ratio="landscape">
              <template #default>
                <div class="w-full h-full bg-blue-500"></div>
              </template>
            </CardTop>
          </template>
          <template #bottom>
            <CardBottom class="bg-neutral-200"></CardBottom>
          </template>
        </CardContainer>
      </CardGridList>
    `
  })
}
