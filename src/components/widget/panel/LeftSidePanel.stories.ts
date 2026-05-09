import { t } from '@/i18n'
import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import LeftSidePanel from './LeftSidePanel.vue'

const meta: Meta<typeof LeftSidePanel> = {
  title: 'Components/Widget/Panel/LeftSidePanel',
  component: LeftSidePanel,
  argTypes: {
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
        label: t('g.installed'),
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
      }
    ]
  },
  render: (args) => ({
    components: { LeftSidePanel },
    setup() {
      const selectedItem = ref(args.modelValue)
      return { args, selectedItem }
    },
    template: `
      <div style="height: 500px; width: 256px;">
        <LeftSidePanel v-model="selectedItem" :nav-items="args.navItems" />
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
        label: t('g.installed'),
        icon: 'icon-[lucide--download]'
      },
      {
        title: 'TAGS',
        items: [
          {
            id: 'tag-sd15',
            label: t('g.sd_1_5'),
            icon: 'icon-[lucide--tag]'
          },
          {
            id: 'tag-sdxl',
            label: t('g.sdxl'),
            icon: 'icon-[lucide--tag]'
          },
          {
            id: 'tag-utility',
            label: t('g.utility'),
            icon: 'icon-[lucide--tag]'
          }
        ]
      },
      {
        title: 'CATEGORIES',
        items: [
          {
            id: 'cat-models',
            label: t('g.models'),
            icon: 'icon-[lucide--layers]'
          },
          {
            id: 'cat-nodes',
            label: t('g.nodes'),
            icon: 'icon-[lucide--grid-3x3]'
          }
        ]
      }
    ]
  },
  render: (args) => ({
    components: { LeftSidePanel },
    setup() {
      const selectedItem = ref(args.modelValue)
      return { args, selectedItem }
    },
    template: `
      <div style="height: 500px; width: 256px;">
        <LeftSidePanel v-model="selectedItem" :nav-items="args.navItems" />
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
        label: t('g.home'),
        icon: 'icon-[lucide--folder]'
      },
      {
        id: 'documents',
        label: t('g.documents'),
        icon: 'icon-[lucide--folder]'
      },
      {
        id: 'downloads',
        label: t('g.downloads'),
        icon: 'icon-[lucide--folder]'
      },
      {
        id: 'desktop',
        label: t('g.desktop'),
        icon: 'icon-[lucide--folder]'
      }
    ]
  },
  render: (args) => ({
    components: { LeftSidePanel },
    setup() {
      const selectedItem = ref(args.modelValue)
      return { args, selectedItem }
    },
    template: `
      <div style="height: 400px; width: 256px;">
        <LeftSidePanel v-model="selectedItem" :nav-items="args.navItems" />
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
        label: t('g.general_settings'),
        icon: 'icon-[lucide--wrench]'
      },
      {
        id: 'appearance',
        label: t('g.appearance_themes_configuration'),
        icon: 'icon-[lucide--wrench]'
      },
      {
        title: 'ADVANCED OPTIONS',
        items: [
          {
            id: 'performance',
            label: t('g.performance_optimization_settings'),
            icon: 'icon-[lucide--zap]'
          },
          {
            id: 'experimental',
            label: t('g.experimental_features_beta'),
            icon: 'icon-[lucide--puzzle]'
          }
        ]
      }
    ]
  },
  render: (args) => ({
    components: { LeftSidePanel },
    setup() {
      const selectedItem = ref(args.modelValue)
      return { args, selectedItem }
    },
    template: `
      <div style="height: 500px; width: 256px;">
        <LeftSidePanel v-model="selectedItem" :nav-items="args.navItems" />
      </div>
    `
  })
}
