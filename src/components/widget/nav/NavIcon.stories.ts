import type { Meta, StoryObj } from '@storybook/vue3-vite'

import NavIcon from './NavIcon.vue'

const availableIcons = [
  'box',
  'command',
  'dumbbell',
  'film',
  'folder',
  'graduation-cap',
  'hand-coins',
  'image',
  'layout-grid',
  'list',
  'maximize-2',
  'message-square-text',
  'puzzle',
  'sliders-horizontal',
  'volume-2',
  'wrench',
  'zap',
  'download',
  'tag',
  'layers',
  'grid-3-x-3'
]

const meta: Meta<typeof NavIcon> = {
  title: 'Components/Widget/Nav/NavIcon',
  component: NavIcon,
  argTypes: {
    name: {
      control: 'select',
      options: availableIcons,
      description: 'Icon name to display'
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Interactive: Story = {
  args: {
    name: 'folder'
  }
}

export const AllIcons: Story = {
  render: () => ({
    components: { NavIcon },
    template: `
      <div class="p-4">
        <h3 class="text-lg font-semibold mb-4">All Available Icons</h3>
        <div class="grid grid-cols-6 gap-4">
          <div v-for="icon in icons" :key="icon" class="flex flex-col items-center gap-2 p-2">
            <NavIcon :name="icon" />
            <span class="text-neutral">{{ icon }}</span>
          </div>
        </div>
      </div>
    `,
    setup() {
      return {
        icons: availableIcons
      }
    }
  }),
  parameters: {
    controls: { disable: true },
    actions: { disable: true }
  }
}
