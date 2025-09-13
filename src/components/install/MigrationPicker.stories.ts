// eslint-disable-next-line storybook/no-renderer-packages
import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'

import MigrationPicker from './MigrationPicker.vue'

const meta: Meta<typeof MigrationPicker> = {
  title: 'Desktop/Components/MigrationPicker',
  component: MigrationPicker,
  parameters: {
    layout: 'padded'
  },
  decorators: [
    (story) => ({
      components: { story },
      template: `
        <div class="p-8" style="min-height: 600px;">
          <story />
        </div>
      `
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

// Default story with no background (to see the actual component background)
export const Default: Story = {
  render: (args) => ({
    components: { MigrationPicker },
    setup() {
      const sourcePath = ref('')
      const migrationItemIds = ref<string[]>([])

      return { args, sourcePath, migrationItemIds }
    },
    template: `
      <MigrationPicker
        v-model:sourcePath="sourcePath"
        v-model:migrationItemIds="migrationItemIds"
      />
    `
  })
}

// With a valid source path to show migration options
export const WithValidSource: Story = {
  render: (args) => ({
    components: { MigrationPicker },
    setup() {
      const sourcePath = ref('/Users/username/ComfyUI')
      const migrationItemIds = ref<string[]>(['models', 'custom_nodes'])

      return { args, sourcePath, migrationItemIds }
    },
    template: `
      <MigrationPicker
        v-model:sourcePath="sourcePath"
        v-model:migrationItemIds="migrationItemIds"
      />
    `
  })
}

// On dark background matching installer step 2
export const OnDarkBackground: Story = {
  parameters: {
    backgrounds: {
      default: 'installer-dark',
      values: [{ name: 'installer-dark', value: '#0a0a0a' }]
    }
  },
  render: (args) => ({
    components: { MigrationPicker },
    setup() {
      const sourcePath = ref('/Users/username/ComfyUI')
      const migrationItemIds = ref<string[]>(['models'])

      return { args, sourcePath, migrationItemIds }
    },
    template: `
      <div class="bg-neutral-950 p-8 rounded-lg">
        <MigrationPicker
          v-model:sourcePath="sourcePath"
          v-model:migrationItemIds="migrationItemIds"
        />
      </div>
    `
  })
}

// Inside accordion to match actual usage
export const InsideAccordion: Story = {
  render: (args) => ({
    components: { MigrationPicker },
    setup() {
      const sourcePath = ref('/Users/username/ComfyUI')
      const migrationItemIds = ref<string[]>([])

      return { args, sourcePath, migrationItemIds }
    },
    template: `
      <div class="bg-transparent">
        <div class="accordion-content">
          <MigrationPicker
            v-model:sourcePath="sourcePath"
            v-model:migrationItemIds="migrationItemIds"
          />
        </div>
      </div>
    `
  })
}

// With transparent background to test inheritance
export const TransparentBackground: Story = {
  render: (args) => ({
    components: { MigrationPicker },
    setup() {
      const sourcePath = ref('/Users/username/ComfyUI')
      const migrationItemIds = ref<string[]>(['models', 'custom_nodes', 'user'])

      return { args, sourcePath, migrationItemIds }
    },
    template: `
      <div style="background: linear-gradient(45deg, #1a1a1a 25%, #2a2a2a 25%, #2a2a2a 50%, #1a1a1a 50%, #1a1a1a 75%, #2a2a2a 75%, #2a2a2a); background-size: 20px 20px;">
        <div class="bg-transparent p-8">
          <MigrationPicker
            v-model:sourcePath="sourcePath"
            v-model:migrationItemIds="migrationItemIds"
          />
        </div>
      </div>
    `
  })
}

// Comparison with neutral-900 background
export const WithNeutral900Background: Story = {
  render: (args) => ({
    components: { MigrationPicker },
    setup() {
      const sourcePath = ref('/Users/username/ComfyUI')
      const migrationItemIds = ref<string[]>(['models'])

      return { args, sourcePath, migrationItemIds }
    },
    template: `
      <div class="flex flex-col gap-4">
        <div class="p-4 border border-neutral-600">
          <h3 class="text-white mb-4">Component on default background:</h3>
          <MigrationPicker
            v-model:sourcePath="sourcePath"
            v-model:migrationItemIds="migrationItemIds"
          />
        </div>
        <div class="p-4 border border-neutral-600 bg-neutral-900">
          <h3 class="text-white mb-4">Component on bg-neutral-900:</h3>
          <MigrationPicker
            v-model:sourcePath="sourcePath"
            v-model:migrationItemIds="migrationItemIds"
          />
        </div>
      </div>
    `
  })
}

// Side by side comparison to debug background
export const BackgroundComparison: Story = {
  render: (args) => ({
    components: { MigrationPicker },
    setup() {
      const sourcePath1 = ref('/Users/username/ComfyUI')
      const sourcePath2 = ref('/Users/username/ComfyUI')
      const migrationItemIds1 = ref<string[]>(['models'])
      const migrationItemIds2 = ref<string[]>(['models'])

      return {
        args,
        sourcePath1,
        sourcePath2,
        migrationItemIds1,
        migrationItemIds2
      }
    },
    template: `
      <div class="flex gap-8">
        <div class="flex-1">
          <h3 class="text-white mb-4 text-center">Without wrapper background</h3>
          <div class="border border-yellow-500 p-4">
            <MigrationPicker
              v-model:sourcePath="sourcePath1"
              v-model:migrationItemIds="migrationItemIds1"
            />
          </div>
        </div>
        <div class="flex-1">
          <h3 class="text-white mb-4 text-center">With bg-neutral-950 wrapper</h3>
          <div class="border border-yellow-500 p-4 bg-neutral-950">
            <MigrationPicker
              v-model:sourcePath="sourcePath2"
              v-model:migrationItemIds="migrationItemIds2"
            />
          </div>
        </div>
      </div>
    `
  })
}

// Error state
export const WithError: Story = {
  render: (args) => ({
    components: { MigrationPicker },
    setup() {
      const sourcePath = ref('/invalid/path/that/does/not/exist')
      const migrationItemIds = ref<string[]>([])

      return { args, sourcePath, migrationItemIds }
    },
    template: `
      <MigrationPicker
        v-model:sourcePath="sourcePath"
        v-model:migrationItemIds="migrationItemIds"
      />
    `
  })
}
