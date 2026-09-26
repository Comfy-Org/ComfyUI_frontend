import type { Meta, StoryObj } from '@storybook/vue3-vite'

import SectionLabel from './SectionLabel.vue'

const meta: Meta<typeof SectionLabel> = {
  title: 'Website/Common/SectionLabel',
  component: SectionLabel,
  tags: ['autodocs'],
  parameters: { layout: 'centered' }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { SectionLabel },
    template: '<SectionLabel>Built for creators</SectionLabel>'
  })
}

export const LongLabel: Story = {
  render: () => ({
    components: { SectionLabel },
    template:
      '<SectionLabel>Production-ready generative AI workflows</SectionLabel>'
  })
}
