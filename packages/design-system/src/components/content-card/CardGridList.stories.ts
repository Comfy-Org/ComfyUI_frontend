import type { Meta, StoryObj } from '@storybook/vue3-vite'

import CardBottom from '@comfyorg/design-system/content-card/CardBottom'
import CardContainer from '@comfyorg/design-system/content-card/CardContainer'
import CardTop from '@comfyorg/design-system/content-card/CardTop'

interface GridArgs {
  minWidth: string
  maxWidth: string
  padding: string
  gap: string
  columns?: number
}

const meta: Meta<GridArgs> = {
  title: 'Components/ContentCard/CardGridList',
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
    components: { CardContainer, CardTop, CardBottom },
    setup() {
      const gridStyle = {
        display: 'grid',
        gridTemplateColumns: args.columns
          ? `repeat(${args.columns}, 1fr)`
          : `repeat(auto-fill, minmax(${args.minWidth}, ${args.maxWidth}))`,
        padding: args.padding,
        gap: args.gap
      }
      return { gridStyle }
    },
    template: `
      <div :style="gridStyle">
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
      </div>
    `
  })
}
