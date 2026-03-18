import type { Meta, StoryObj } from '@storybook/vue3-vite'

import LogoComfyWaveLoader from './LogoComfyWaveLoader.vue'

const meta: Meta<typeof LogoComfyWaveLoader> = {
  title: 'Components/Loader/LogoComfyWaveLoader',
  component: LogoComfyWaveLoader,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' }
  },
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl']
    },
    color: {
      control: 'select',
      options: ['yellow', 'blue', 'white', 'black']
    },
    bordered: {
      control: 'boolean'
    },
    disableAnimation: {
      control: 'boolean'
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Small: Story = {
  args: { size: 'sm' }
}

export const Large: Story = {
  args: { size: 'lg' }
}

export const ExtraLarge: Story = {
  args: { size: 'xl' }
}

export const NoBorder: Story = {
  args: { bordered: false }
}

export const Static: Story = {
  args: { disableAnimation: true }
}

export const BrandColors: Story = {
  render: () => ({
    components: { LogoComfyWaveLoader },
    template: `
      <div class="flex flex-col items-center gap-12">
        <div class="flex flex-col items-center gap-2">
          <span class="text-xs text-neutral-400">#F0FF41 (Yellow)</span>
          <LogoComfyWaveLoader size="lg" color="yellow" />
        </div>
        <div class="flex flex-col items-center gap-2">
          <span class="text-xs text-neutral-400">#172DD7 (Blue)</span>
          <LogoComfyWaveLoader size="lg" color="blue" />
        </div>
        <div class="flex flex-col items-center gap-2">
          <span class="text-xs text-neutral-400">White</span>
          <LogoComfyWaveLoader size="lg" color="white" />
        </div>
        <div class="p-4 bg-white rounded" style="background: white">
          <div class="flex flex-col items-center gap-2">
            <span class="text-xs text-neutral-600">Black</span>
            <LogoComfyWaveLoader size="lg" color="black" />
          </div>
        </div>
      </div>
    `
  })
}

export const AllSizes: Story = {
  render: () => ({
    components: { LogoComfyWaveLoader },
    template: `
      <div class="flex flex-col items-center gap-8">
        <LogoComfyWaveLoader size="sm" color="yellow" />
        <LogoComfyWaveLoader size="md" color="yellow" />
        <LogoComfyWaveLoader size="lg" color="yellow" />
        <LogoComfyWaveLoader size="xl" color="yellow" />
      </div>
    `
  })
}
