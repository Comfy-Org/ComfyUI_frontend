import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { Folder, Puzzle, Settings } from 'lucide-vue-next'
import { ref } from 'vue'

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
      { id: 'installed', label: 'Installed', iconName: 'download' },
      { id: 'models', label: 'Models', iconName: 'layers' },
      { id: 'nodes', label: 'Nodes', iconName: 'grid-3-x-3' }
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
      { id: 'installed', label: 'Installed', iconName: 'download' },
      {
        title: 'TAGS',
        items: [
          { id: 'tag-sd15', label: 'SD 1.5', iconName: 'tag' },
          { id: 'tag-sdxl', label: 'SDXL', iconName: 'tag' },
          { id: 'tag-utility', label: 'Utility', iconName: 'tag' }
        ]
      },
      {
        title: 'CATEGORIES',
        items: [
          { id: 'cat-models', label: 'Models', iconName: 'layers' },
          { id: 'cat-nodes', label: 'Nodes', iconName: 'grid-3-x-3' }
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
      { id: 'home', label: 'Home' },
      { id: 'documents', label: 'Documents' },
      { id: 'downloads', label: 'Downloads' },
      { id: 'desktop', label: 'Desktop' }
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
      { id: 'general', label: 'General Settings', iconName: 'wrench' },
      {
        id: 'appearance',
        label: 'Appearance & Themes Configuration',
        iconName: 'image'
      },
      {
        title: 'ADVANCED OPTIONS',
        items: [
          {
            id: 'performance',
            label: 'Performance & Optimization Settings',
            iconName: 'zap'
          },
          {
            id: 'experimental',
            label: 'Experimental Features (Beta)',
            iconName: 'puzzle'
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
