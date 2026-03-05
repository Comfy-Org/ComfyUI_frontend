import type { Meta, StoryObj } from '@storybook/vue3-vite'

import LogoCFillLoader from './LogoCFillLoader.vue'

const meta: Meta<typeof LogoCFillLoader> = {
  title: 'Components/Loader/LogoCFillLoader',
  component: LogoCFillLoader,
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
    components: { LogoCFillLoader },
    template: `
      <div class="flex items-end gap-12">
        <div class="flex flex-col items-center gap-2">
          <span class="text-xs text-neutral-400">#F0FF41</span>
          <LogoCFillLoader size="lg" class="text-[#F0FF41]" />
        </div>
        <div class="flex flex-col items-center gap-2">
          <span class="text-xs text-neutral-400">#172DD7</span>
          <LogoCFillLoader size="lg" class="text-[#172DD7]" />
        </div>
        <div class="flex flex-col items-center gap-2">
          <span class="text-xs text-neutral-400">White</span>
          <LogoCFillLoader size="lg" class="text-white" />
        </div>
        <div class="p-4 bg-white rounded" style="background: white">
          <div class="flex flex-col items-center gap-2">
            <span class="text-xs text-neutral-600">Black</span>
            <LogoCFillLoader size="lg" class="text-black" />
          </div>
        </div>
      </div>
    `
  })
}

export const AllSizes: Story = {
  render: () => ({
    components: { LogoCFillLoader },
    template: `
      <div class="flex items-end gap-8">
        <LogoCFillLoader size="sm" class="text-[#F0FF41]" />
        <LogoCFillLoader size="md" class="text-[#F0FF41]" />
        <LogoCFillLoader size="lg" class="text-[#F0FF41]" />
        <LogoCFillLoader size="xl" class="text-[#F0FF41]" />
      </div>
    `
  })
}
