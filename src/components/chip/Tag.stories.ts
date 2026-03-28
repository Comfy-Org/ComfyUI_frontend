import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Tag from './Tag.vue'

const meta: Meta<typeof Tag> = {
  title: 'Components/Tag',
  component: Tag,
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text' },
    shape: {
      control: 'select',
      options: ['square', 'rounded']
    },
    removable: { control: 'boolean' }
  },
  args: {
    label: 'Tag',
    shape: 'square',
    removable: false
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Rounded: Story = {
  args: {
    label: 'Tag',
    shape: 'rounded'
  }
}

export const Removable: Story = {
  args: {
    label: 'Tag',
    removable: true
  }
}

export const RemovableRounded: Story = {
  args: {
    label: 'Tag',
    shape: 'rounded',
    removable: true
  }
}

export const AllShapes: Story = {
  render: () => ({
    components: { Tag },
    template: `
      <div class="flex items-center gap-2">
        <Tag label="Square" shape="square" />
        <Tag label="Rounded" shape="rounded" />
      </div>
    `
  })
}

export const AllStates: Story = {
  render: () => ({
    components: { Tag },
    template: `
      <div class="flex flex-col gap-4">
        <div class="flex items-center gap-2">
          <Tag label="Default" />
          <Tag label="Removable" removable />
        </div>
        <div class="flex items-center gap-2">
          <Tag label="Default" shape="rounded" />
          <Tag label="Removable" shape="rounded" removable />
        </div>
      </div>
    `
  })
}

export const TagList: Story = {
  render: () => ({
    components: { Tag },
    template: `
      <div class="flex flex-wrap gap-2">
        <Tag label="JavaScript" />
        <Tag label="TypeScript" />
        <Tag label="Vue.js" />
        <Tag label="React" />
        <Tag label="Node.js" />
        <Tag label="Python" />
        <Tag label="Docker" />
        <Tag label="Kubernetes" />
      </div>
    `
  })
}
