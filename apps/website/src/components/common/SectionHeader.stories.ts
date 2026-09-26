import type { Meta, StoryObj } from '@storybook/vue3-vite'

import SectionHeader from './SectionHeader.vue'

const meta: Meta<typeof SectionHeader> = {
  title: 'Website/Common/SectionHeader',
  component: SectionHeader,
  tags: ['autodocs'],
  args: {
    label: 'Why Comfy',
    align: 'center',
    headingSize: 'section',
    maxWidth: 'lg'
  },
  render: (args) => ({
    components: { SectionHeader },
    setup: () => ({ args }),
    template: `
      <SectionHeader v-bind="args">
        The creative engine for generative AI
        <template #subtitle>
          <p class="mx-auto mt-5 max-w-2xl text-base text-primary-comfy-canvas/70">
            Build, iterate, and ship visual workflows with complete control.
          </p>
        </template>
      </SectionHeader>
    `
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const StartAligned: Story = {
  args: {
    align: 'start',
    maxWidth: 'xl'
  }
}

export const HeroScale: Story = {
  args: {
    headingTag: 'h1',
    headingSize: 'hero',
    label: 'Comfy Cloud'
  }
}

export const WithoutLabel: Story = {
  args: {
    label: undefined
  }
}

export const Mobile: Story = {
  globals: {
    viewport: { value: 'mobile1', isRotated: false }
  }
}
