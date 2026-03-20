import type { Meta, StoryObj } from '@storybook/vue3-vite'

import PresetMenu from './PresetMenu.vue'

const meta = {
  title: 'Builder/PresetMenu',
  component: PresetMenu,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered'
  }
} satisfies Meta<typeof PresetMenu>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  render: () => ({
    components: { PresetMenu },
    setup() {
      return {}
    },
    template: `
      <div class="p-8">
        <p class="mb-4 text-sm text-muted-foreground">No presets saved — shows empty state:</p>
        <PresetMenu />
      </div>
    `
  })
}

export const WithPresets: Story = {
  render: () => ({
    components: { PresetMenu },
    setup() {
      return {}
    },
    template: `
      <div class="p-8">
        <p class="mb-4 text-sm text-muted-foreground">Click to see built-in quick presets (Min/Mid/Max) and saved presets:</p>
        <PresetMenu />
      </div>
    `
  })
}

export const InToolbar: Story = {
  render: () => ({
    components: { PresetMenu },
    setup() {
      return {}
    },
    template: `
      <div class="flex h-12 items-center gap-2 rounded-lg border border-border-subtle bg-comfy-menu-bg px-4 py-2 min-w-80">
        <span class="truncate font-bold">my_workflow.json</span>
        <div class="flex-1" />
        <PresetMenu />
      </div>
    `
  })
}
