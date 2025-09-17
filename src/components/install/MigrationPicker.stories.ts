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
      <div class="accordion-content">
        <MigrationPicker
          v-model:sourcePath="sourcePath"
          v-model:migrationItemIds="migrationItemIds"
        />
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
