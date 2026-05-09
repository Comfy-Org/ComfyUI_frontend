import { t } from '@/i18n'
import type { Meta, StoryObj } from '@storybook/vue3-vite'

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

export const InteractiveList: Story = {
  render: () => ({
    components: { NavItem },
    template: `
      <div class="space-y-1">
        <NavItem
          v-for="item in items"
          :key="item.id"
          :icon="item.icon"
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
      const items = [
        {
          id: 'downloads',
          label: t('g.downloads'),
          icon: 'icon-[lucide--download]'
        },
        {
          id: 'models',
          label: t('g.models'),
          icon: 'icon-[lucide--layers]'
        },
        {
          id: 'nodes',
          label: t('g.nodes'),
          icon: 'icon-[lucide--grid-3x3]'
        },
        {
          id: 'tags',
          label: t('g.tags'),
          icon: 'icon-[lucide--tag]'
        },
        {
          id: 'settings',
          label: t('g.settings'),
          icon: 'icon-[lucide--wrench]'
        },
        {
          id: 'default',
          label: t('g.default_icon'),
          icon: 'icon-[lucide--folder]'
        }
      ]

      return { items }
    }
  }),
  parameters: {
    controls: { disable: true }
  }
}
