import type { Meta, StoryObj } from '@storybook/vue3-vite'
import {
  Download,
  Folder,
  Grid3x3,
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
        icon: () => h(Download, { size: 14 })
      },
      {
        id: 'models',
        label: 'Models',
        icon: () => h(Layers, { size: 14 })
      },
      {
        id: 'nodes',
        label: 'Nodes',
        icon: () => h(Grid3x3, { size: 14 })
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
        icon: () => h(Download, { size: 14 })
      },
      {
        title: 'TAGS',
        items: [
          {
            id: 'tag-sd15',
            label: 'SD 1.5',
            icon: () => h(Tag, { size: 14 })
          },
          {
            id: 'tag-sdxl',
            label: 'SDXL',
            icon: () => h(Tag, { size: 14 })
          },
          {
            id: 'tag-utility',
            label: 'Utility',
            icon: () => h(Tag, { size: 14 })
          }
        ]
      },
      {
        title: 'CATEGORIES',
        items: [
          {
            id: 'cat-models',
            label: 'Models',
            icon: () => h(Layers, { size: 14 })
          },
          {
            id: 'cat-nodes',
            label: 'Nodes',
            icon: () => h(Grid3x3, { size: 14 })
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
        icon: () => h(Folder, { size: 14 })
      },
      {
        id: 'documents',
        label: 'Documents',
        icon: () => h(Folder, { size: 14 })
      },
      {
        id: 'downloads',
        label: 'Downloads',
        icon: () => h(Folder, { size: 14 })
      },
      {
        id: 'desktop',
        label: 'Desktop',
        icon: () => h(Folder, { size: 14 })
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
        icon: () => h(() => Wrench, { size: 14 })
      },
      {
        id: 'appearance',
        label: 'Appearance & Themes Configuration',
        icon: () => h(() => Wrench, { size: 14 })
      },
      {
        title: 'ADVANCED OPTIONS',
        items: [
          {
            id: 'performance',
            label: 'Performance & Optimization Settings',
            icon: () => h(() => Zap, { size: 14 })
          },
          {
            id: 'experimental',
            label: 'Experimental Features (Beta)',
            icon: () => h(() => Puzzle, { size: 14 })
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
