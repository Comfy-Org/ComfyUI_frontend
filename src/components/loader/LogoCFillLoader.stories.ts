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
    components: { LogoCFillLoader },
    template: `
      <div class="flex items-end gap-12">
        <div class="flex flex-col items-center gap-2">
          <span class="text-xs text-neutral-400">Yellow</span>
          <LogoCFillLoader size="lg" color="yellow" />
        </div>
        <div class="flex flex-col items-center gap-2">
          <span class="text-xs text-neutral-400">Blue</span>
          <LogoCFillLoader size="lg" color="blue" />
        </div>
        <div class="flex flex-col items-center gap-2">
          <span class="text-xs text-neutral-400">White</span>
          <LogoCFillLoader size="lg" color="white" />
        </div>
        <div class="p-4 bg-white rounded" style="background: white">
          <div class="flex flex-col items-center gap-2">
            <span class="text-xs text-neutral-600">Black</span>
            <LogoCFillLoader size="lg" color="black" />
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
        <LogoCFillLoader size="sm" color="yellow" />
        <LogoCFillLoader size="md" color="yellow" />
        <LogoCFillLoader size="lg" color="yellow" />
        <LogoCFillLoader size="xl" color="yellow" />
      </div>
    `
  })
}
