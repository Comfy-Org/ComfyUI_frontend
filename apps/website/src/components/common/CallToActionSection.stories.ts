import type { Meta, StoryObj } from '@storybook/vue3-vite'

import CallToActionSection from './CallToActionSection.vue'

const meta: Meta<typeof CallToActionSection> = {
  title: 'Website/Common/CallToActionSection',
  component: CallToActionSection,
  tags: ['autodocs'],
  args: {
    headingKey: 'learning.cta.heading',
    primaryLabelKey: 'cta.tryWorkflow',
    primaryHref: '#',
    secondaryLabelKey: 'learning.cta.runComfy',
    secondaryHref: '#'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const PrimaryOnly: Story = {
  args: {
    secondaryLabelKey: undefined,
    secondaryHref: undefined
  }
}

export const Chinese: Story = {
  args: {
    locale: 'zh-CN'
  }
}

export const Mobile: Story = {
  globals: {
    viewport: { value: 'mobile1', isRotated: false }
  }
}
