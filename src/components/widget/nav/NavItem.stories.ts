import type { Meta, StoryObj } from '@storybook/vue3-vite'

import NavItem from './NavItem.vue'

const availableIcons = [
  undefined, // for default folder icon
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

const meta: Meta<typeof NavItem> = {
  title: 'Components/Widget/Nav/NavItem',
  component: NavItem,
  argTypes: {
    iconName: {
      control: 'select',
      options: availableIcons,
      description: 'Icon name to display (undefined shows default folder)'
    },
    active: {
      control: 'boolean',
      description: 'Active state of the nav item'
    },
    onClick: {
      table: { disable: true }
    },
    default: {
      control: 'text',
      description: 'Text content for the nav item'
    }
  },
  args: {
    active: false,
    onClick: () => {},
    default: 'Navigation Item'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Interactive: Story = {
  args: {
    iconName: 'folder',
    active: false,
    default: 'Navigation Item'
  },
  render: (args) => ({
    components: { NavItem },
    setup() {
      return { args }
    },
    template: `
      <NavItem :icon-name="args.iconName" :active="args.active" :on-click="() => {}">
        {{ args.default }}
      </NavItem>
    `
  })
}

export const InteractiveList: Story = {
  render: () => ({
    components: { NavItem },
    template: `
      <div class="space-y-1">
        <NavItem
          v-for="item in items"
          :key="item.id"
          :icon-name="item.iconName"
          :active="selectedId === item.id"
          :on-click="() => selectedId = item.id"
        >
          {{ item.label }}
        </NavItem>
      </div>
    `,
    data() {
      return {
        selectedId: 'downloads',
        items: [
          { id: 'downloads', label: 'Downloads', iconName: 'download' },
          { id: 'models', label: 'Models', iconName: 'layers' },
          { id: 'nodes', label: 'Nodes', iconName: 'grid-3-x-3' },
          { id: 'tags', label: 'Tags', iconName: 'tag' },
          { id: 'settings', label: 'Settings', iconName: 'wrench' },
          { id: 'default', label: 'Default Icon' } // no iconName
        ]
      }
    }
  }),
  parameters: {
    controls: { disable: true }
  }
}
