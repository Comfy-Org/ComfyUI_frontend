import type { Meta, StoryObj } from '@storybook/vue3'

import HardwareOption from './HardwareOption.vue'

const meta: Meta<typeof HardwareOption> = {
  title: 'Install/HardwareOption',
  component: HardwareOption,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: '#1a1a1a' }]
    }
  },
  argTypes: {
    selected: { control: 'boolean' },
    imagePath: { control: 'text' },
    placeholderText: { control: 'text' },
    subtitle: { control: 'text' }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const AppleMetalSelected: Story = {
  args: {
    imagePath: '/assets/images/apple-mps-logo.png',
    placeholderText: 'Apple Metal',
    subtitle: 'Apple Metal',
    value: 'mps',
    selected: true
  }
}

export const AppleMetalUnselected: Story = {
  args: {
    imagePath: '/assets/images/apple-mps-logo.png',
    placeholderText: 'Apple Metal',
    subtitle: 'Apple Metal',
    value: 'mps',
    selected: false
  }
}

export const CPUOption: Story = {
  args: {
    placeholderText: 'CPU',
    subtitle: 'Subtitle',
    value: 'cpu',
    selected: false
  }
}

export const ManualInstall: Story = {
  args: {
    placeholderText: 'Manual Install',
    subtitle: 'Subtitle',
    value: 'unsupported',
    selected: false
  }
}
