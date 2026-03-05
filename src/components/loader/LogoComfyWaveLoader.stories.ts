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
    bordered: {
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

export const BrandColors: Story = {
  render: () => ({
    components: { LogoComfyWaveLoader },
    template: `
      <div class="flex flex-col items-center gap-12">
        <div class="flex flex-col items-center gap-2">
          <span class="text-xs text-neutral-400">#F0FF41 (Yellow)</span>
          <LogoComfyWaveLoader size="lg" class="text-[#F0FF41]" />
        </div>
        <div class="flex flex-col items-center gap-2">
          <span class="text-xs text-neutral-400">#172DD7 (Blue)</span>
          <LogoComfyWaveLoader size="lg" class="text-[#172DD7]" />
        </div>
        <div class="flex flex-col items-center gap-2">
          <span class="text-xs text-neutral-400">White</span>
          <LogoComfyWaveLoader size="lg" class="text-white" />
        </div>
        <div class="p-4 bg-white rounded" style="background: white">
          <div class="flex flex-col items-center gap-2">
            <span class="text-xs text-neutral-600">Black</span>
            <LogoComfyWaveLoader size="lg" class="text-black" />
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
        <LogoComfyWaveLoader size="sm" class="text-[#F0FF41]" />
        <LogoComfyWaveLoader size="md" class="text-[#F0FF41]" />
        <LogoComfyWaveLoader size="lg" class="text-[#F0FF41]" />
        <LogoComfyWaveLoader size="xl" class="text-[#F0FF41]" />
      </div>
    `
  })
}
