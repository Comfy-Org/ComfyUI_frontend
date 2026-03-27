import type { Meta, StoryObj } from '@storybook/vue3-vite'

import PresetMenu from './PresetMenu.vue'

const meta = {
  title: 'Builder/PresetMenu',
  component: PresetMenu,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#1a1a1b' },
        { name: 'light', value: '#ffffff' },
        { name: 'sidebar', value: '#232326' }
      ]
    }
  }
} satisfies Meta<typeof PresetMenu>

export default meta
type Story = StoryObj<typeof meta>

/** Default rendering — click to see built-in quick presets (Min/Mid/Max) and saved presets. */
export const Default: Story = {
  render: () => ({
    components: { PresetMenu },
    template: `
      <div class="p-8">
        <PresetMenu />
      </div>
    `
  })
}

/** In a toolbar context alongside a workflow title. */
export const InToolbar: Story = {
  render: () => ({
    components: { PresetMenu },
    template: `
      <div class="flex h-12 items-center gap-2 rounded-lg border border-border-subtle bg-comfy-menu-bg px-4 py-2 min-w-80">
        <span class="truncate font-bold">my_workflow.json</span>
        <div class="flex-1" />
        <PresetMenu />
      </div>
    `
  })
}

/** On sidebar background — verify contrast against dark sidebar. */
export const OnSidebarBackground: Story = {
  parameters: {
    backgrounds: { default: 'sidebar' }
  },
  render: () => ({
    components: { PresetMenu },
    template: `
      <div class="p-8">
        <PresetMenu />
      </div>
    `
  })
}

/** Narrow container — verify truncation of long preset names. */
export const Compact: Story = {
  render: () => ({
    components: { PresetMenu },
    template: `
      <div class="flex h-10 w-48 items-center rounded-lg border border-border-subtle bg-comfy-menu-bg px-2">
        <span class="truncate text-sm font-bold">long_workflow_name.json</span>
        <div class="flex-1" />
        <PresetMenu />
      </div>
    `
  })
}
