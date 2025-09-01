import type { Meta, StoryObj } from '@storybook/vue3-vite'
import {
  Download,
  Folder,
  Grid3x3,
  Image,
  Layers,
  Puzzle,
  Settings,
  Tag,
  Wrench,
  Zap
} from 'lucide-vue-next'
import { h, ref } from 'vue'

import LeftSidePanel from './LeftSidePanel.vue'

const meta: Meta<typeof LeftSidePanel> = {
  title: 'Components/Widget/Panel/LeftSidePanel',
  component: LeftSidePanel,
  argTypes: {
    'header-icon': {
      table: {
        type: { summary: 'slot' },
        defaultValue: { summary: 'undefined' }
      },
      control: false
    },
    'header-title': {
      table: {
        type: { summary: 'slot' },
        defaultValue: { summary: 'undefined' }
      },
      control: false
    },
    'onUpdate:modelValue': {
      table: { disable: true }
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    modelValue: 'installed',
    navItems: [
      {
        id: 'installed',
        label: 'Installed',
        icon: { render: () => h(Download, { size: 14 }) } as any
      },
      {
        id: 'models',
        label: 'Models',
        icon: { render: () => h(Layers, { size: 14 }) } as any
      },
      {
        id: 'nodes',
        label: 'Nodes',
        icon: { render: () => h(Grid3x3, { size: 14 }) } as any
      }
    ]
  },
  render: (args) => ({
    components: { LeftSidePanel, Puzzle },
    setup() {
      const selectedItem = ref(args.modelValue)
      return { args, selectedItem }
    },
    template: `
      <div style="height: 500px; width: 256px;">
        <LeftSidePanel v-model="selectedItem" :nav-items="args.navItems">
          <template #header-icon>
            <Puzzle :size="16" class="text-neutral" />
          </template>
          <template #header-title>
            <span class="text-neutral text-base">Navigation</span>
          </template>
        </LeftSidePanel>
      </div>
    `
  })
}

export const WithGroups: Story = {
  args: {
    modelValue: 'tag-sd15',
    navItems: [
      {
        id: 'installed',
        label: 'Installed',
        icon: { render: () => h(Download, { size: 14 }) } as any
      },
      {
        title: 'TAGS',
        items: [
          {
            id: 'tag-sd15',
            label: 'SD 1.5',
            icon: { render: () => h(Tag, { size: 14 }) } as any
          },
          {
            id: 'tag-sdxl',
            label: 'SDXL',
            icon: { render: () => h(Tag, { size: 14 }) } as any
          },
          {
            id: 'tag-utility',
            label: 'Utility',
            icon: { render: () => h(Tag, { size: 14 }) } as any
          }
        ]
      },
      {
        title: 'CATEGORIES',
        items: [
          {
            id: 'cat-models',
            label: 'Models',
            icon: { render: () => h(Layers, { size: 14 }) } as any
          },
          {
            id: 'cat-nodes',
            label: 'Nodes',
            icon: { render: () => h(Grid3x3, { size: 14 }) } as any
          }
        ]
      }
    ]
  },
  render: (args) => ({
    components: { LeftSidePanel, Puzzle },
    setup() {
      const selectedItem = ref(args.modelValue)
      return { args, selectedItem }
    },
    template: `
      <div style="height: 500px; width: 256px;">
        <LeftSidePanel v-model="selectedItem" :nav-items="args.navItems">
          <template #header-icon>
            <Puzzle :size="16" class="text-neutral" />
          </template>
          <template #header-title>
            <span class="text-neutral text-base">Model Selector</span>
          </template>
        </LeftSidePanel>
        <div class="mt-4 p-2 text-sm">
          Selected: {{ selectedItem }}
        </div>
      </div>
    `
  })
}

export const DefaultIcons: Story = {
  args: {
    modelValue: 'home',
    navItems: [
      {
        id: 'home',
        label: 'Home',
        icon: { render: () => h(Folder, { size: 14 }) } as any
      },
      {
        id: 'documents',
        label: 'Documents',
        icon: { render: () => h(Folder, { size: 14 }) } as any
      },
      {
        id: 'downloads',
        label: 'Downloads',
        icon: { render: () => h(Folder, { size: 14 }) } as any
      },
      {
        id: 'desktop',
        label: 'Desktop',
        icon: { render: () => h(Folder, { size: 14 }) } as any
      }
    ]
  },
  render: (args) => ({
    components: { LeftSidePanel, Folder },
    setup() {
      const selectedItem = ref(args.modelValue)
      return { args, selectedItem }
    },
    template: `
      <div style="height: 400px; width: 256px;">
        <LeftSidePanel v-model="selectedItem" :nav-items="args.navItems">
          <template #header-icon>
            <Folder :size="16" class="text-neutral" />
          </template>
          <template #header-title>
            <span class="text-neutral text-base">Files</span>
          </template>
        </LeftSidePanel>
      </div>
    `
  })
}

export const LongLabels: Story = {
  args: {
    modelValue: 'general',
    navItems: [
      {
        id: 'general',
        label: 'General Settings',
        icon: { render: () => h(Wrench, { size: 14 }) } as any
      },
      {
        id: 'appearance',
        label: 'Appearance & Themes Configuration',
        icon: { render: () => h(Image, { size: 14 }) } as any
      },
      {
        title: 'ADVANCED OPTIONS',
        items: [
          {
            id: 'performance',
            label: 'Performance & Optimization Settings',
            icon: { render: () => h(Zap, { size: 14 }) } as any
          },
          {
            id: 'experimental',
            label: 'Experimental Features (Beta)',
            icon: { render: () => h(Puzzle, { size: 14 }) } as any
          }
        ]
      }
    ]
  },
  render: (args) => ({
    components: { LeftSidePanel, Settings },
    setup() {
      const selectedItem = ref(args.modelValue)
      return { args, selectedItem }
    },
    template: `
      <div style="height: 500px; width: 256px;">
        <LeftSidePanel v-model="selectedItem" :nav-items="args.navItems">
          <template #header-icon>
            <Settings :size="16" class="text-neutral" />
          </template>
          <template #header-title>
            <span class="text-neutral text-base">Settings</span>
          </template>
        </LeftSidePanel>
      </div>
    `
  })
}
