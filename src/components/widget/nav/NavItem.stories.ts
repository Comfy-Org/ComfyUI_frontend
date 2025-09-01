import type { Meta, StoryObj } from '@storybook/vue3-vite'
import {
  Box,
  Command,
  Download,
  Dumbbell,
  Film,
  Folder,
  GraduationCap,
  Grid3x3,
  HandCoins,
  Image,
  Layers,
  LayoutGrid,
  List,
  Maximize2,
  MessageSquareText,
  Puzzle,
  SlidersHorizontal,
  Tag,
  Volume2,
  Wrench,
  Zap
} from 'lucide-vue-next'
import { h } from 'vue'

import NavItem from './NavItem.vue'

const availableIcons = [
  { name: 'box', component: Box },
  { name: 'command', component: Command },
  { name: 'dumbbell', component: Dumbbell },
  { name: 'film', component: Film },
  { name: 'folder', component: Folder },
  { name: 'graduation-cap', component: GraduationCap },
  { name: 'hand-coins', component: HandCoins },
  { name: 'image', component: Image },
  { name: 'layout-grid', component: LayoutGrid },
  { name: 'list', component: List },
  { name: 'maximize-2', component: Maximize2 },
  { name: 'message-square-text', component: MessageSquareText },
  { name: 'puzzle', component: Puzzle },
  { name: 'sliders-horizontal', component: SlidersHorizontal },
  { name: 'volume-2', component: Volume2 },
  { name: 'wrench', component: Wrench },
  { name: 'zap', component: Zap },
  { name: 'download', component: Download },
  { name: 'tag', component: Tag },
  { name: 'layers', component: Layers },
  { name: 'grid-3x3', component: Grid3x3 }
]

const meta: Meta<typeof NavItem> = {
  title: 'Components/Widget/Nav/NavItem',
  component: NavItem,
  argTypes: {
    icon: {
      control: 'select',
      options: availableIcons.map((i) => i.name),
      mapping: availableIcons.reduce(
        (acc, i) => ({ ...acc, [i.name]: i.component }),
        {}
      ),
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
