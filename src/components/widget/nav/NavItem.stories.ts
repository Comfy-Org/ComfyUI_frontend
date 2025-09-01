import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { Download, Folder, Grid3x3, Layers, Tag, Wrench } from 'lucide-vue-next'
import { h } from 'vue'

import NavItem from './NavItem.vue'

const meta: Meta<typeof NavItem> = {
  title: 'Components/Widget/Nav/NavItem',
  component: NavItem,
  argTypes: {
    icon: {
      control: 'select',
      description: 'Icon component to display'
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
    icon: Folder as any,
    active: false,
    default: 'Navigation Item'
  },
  render: (args) => ({
    components: { NavItem },
    setup() {
      const IconComponent = args.icon
      const WrappedIcon = {
        render() {
          return h(IconComponent, { size: 14 })
        }
      }
      return { args, WrappedIcon }
    },
    template: `
      <NavItem :icon="WrappedIcon" :active="args.active" :on-click="() => {}">
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
          :icon="item.wrappedIcon"
          :active="selectedId === item.id"
          :on-click="() => selectedId = item.id"
        >
          {{ item.label }}
        </NavItem>
      </div>
    `,
    data() {
      return {
        selectedId: 'downloads'
      }
    },
    setup() {
      const createIconWrapper = (IconComponent: any) => ({
        render() {
          return h(IconComponent, { size: 14 })
        }
      })

      const items = [
        {
          id: 'downloads',
          label: 'Downloads',
          wrappedIcon: createIconWrapper(Download)
        },
        {
          id: 'models',
          label: 'Models',
          wrappedIcon: createIconWrapper(Layers)
        },
        {
          id: 'nodes',
          label: 'Nodes',
          wrappedIcon: createIconWrapper(Grid3x3)
        },
        {
          id: 'tags',
          label: 'Tags',
          wrappedIcon: createIconWrapper(Tag)
        },
        {
          id: 'settings',
          label: 'Settings',
          wrappedIcon: createIconWrapper(Wrench)
        },
        {
          id: 'default',
          label: 'Default Icon',
          wrappedIcon: createIconWrapper(Folder)
        }
      ]

      return { items }
    }
  }),
  parameters: {
    controls: { disable: true }
  }
}
