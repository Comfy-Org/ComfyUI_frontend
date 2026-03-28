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
    state: {
      control: 'select',
      options: ['default', 'unselected', 'selected']
    },
    removable: { control: 'boolean' }
  },
  args: {
    label: 'Tag',
    shape: 'square',
    state: 'default',
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

export const Unselected: Story = {
  args: {
    label: 'Tag',
    state: 'unselected'
  }
}

export const Removable: Story = {
  args: {
    label: 'Tag',
    removable: true
  }
}

export const AllStates: Story = {
  render: () => ({
    components: { Tag },
    template: `
      <div class="flex flex-col gap-4">
        <div>
          <p class="mb-2 text-xs text-muted-foreground">Square</p>
          <div class="flex items-center gap-2">
            <Tag label="Default" />
            <Tag label="Unselected" state="unselected" />
            <Tag label="Selected" removable />
          </div>
        </div>
        <div>
          <p class="mb-2 text-xs text-muted-foreground">Rounded</p>
          <div class="flex items-center gap-2">
            <Tag label="Default" shape="rounded" />
            <Tag label="Unselected" shape="rounded" state="unselected" />
            <Tag label="Selected" shape="rounded" removable />
          </div>
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
