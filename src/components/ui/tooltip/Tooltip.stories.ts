import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Button from '@/components/ui/button/Button.vue'

import Tooltip from './Tooltip.vue'

const meta = {
  title: 'UI/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered'
  },
  argTypes: {
    side: {
      control: 'select',
      options: ['top', 'bottom', 'left', 'right']
    },
    size: {
      control: 'select',
      options: ['sm', 'lg']
    }
  }
} satisfies Meta<typeof Tooltip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => ({
    components: { Tooltip, Button },
    setup: () => ({ args }),
    template: `
      <Tooltip v-bind="args">
        <Button>Hover me</Button>
      </Tooltip>
    `
  }),
  args: {
    text: 'This is a tooltip',
    side: 'top',
    size: 'sm'
  }
}

export const Small: Story = {
  render: () => ({
    components: { Tooltip, Button },
    template: `
      <div class="flex gap-12 p-20">
        <Tooltip text="Tool tip left aligned" side="top" size="sm">
          <Button>Top</Button>
        </Tooltip>
        <Tooltip text="Tool tip center aligned" side="bottom" size="sm">
          <Button>Bottom</Button>
        </Tooltip>
        <Tooltip text="Tool tip right aligned" side="left" size="sm">
          <Button>Left</Button>
        </Tooltip>
        <Tooltip text="Tool tip pointing left" side="right" size="sm">
          <Button>Right</Button>
        </Tooltip>
      </div>
    `
  })
}

export const Large: Story = {
  render: () => ({
    components: { Tooltip, Button },
    template: `
      <div class="flex gap-12 p-20">
        <Tooltip text="Lorem ipsum dolor sit amet, consectetur dolor si adipiscing elit. Proin maximus nisl nec posuere mattis." side="top" size="lg">
          <Button>Top</Button>
        </Tooltip>
        <Tooltip text="Lorem ipsum dolor sit amet, consectetur dolor si adipiscing elit. Proin maximus nisl nec posuere mattis." side="bottom" size="lg">
          <Button>Bottom</Button>
        </Tooltip>
        <Tooltip text="Lorem ipsum dolor sit amet, consectetur dolor si adipiscing elit. Proin maximus nisl nec posuere mattis." side="left" size="lg">
          <Button>Left</Button>
        </Tooltip>
        <Tooltip text="Lorem ipsum dolor sit amet, consectetur dolor si adipiscing elit. Proin maximus nisl nec posuere mattis." side="right" size="lg">
          <Button>Right</Button>
        </Tooltip>
      </div>
    `
  })
}

export const WithKeybind: Story = {
  render: () => ({
    components: { Tooltip, Button },
    template: `
      <div class="flex gap-12 p-20">
        <Tooltip text="Select all" keybind="Ctrl+A" side="top" size="sm">
          <Button>With keybind</Button>
        </Tooltip>
        <Tooltip text="Save" keybind="Ctrl+S" side="bottom" size="sm">
          <Button>Save</Button>
        </Tooltip>
        <Tooltip text="Undo" keybind="Ctrl+Z" side="right" size="sm">
          <Button>Undo</Button>
        </Tooltip>
      </div>
    `
  })
}

export const AllSides: Story = {
  render: () => ({
    components: { Tooltip, Button },
    template: `
      <div class="flex flex-col items-center gap-12 p-20">
        <Tooltip text="Top tooltip" side="top">
          <Button>Top</Button>
        </Tooltip>
        <div class="flex gap-12">
          <Tooltip text="Left tooltip" side="left">
            <Button>Left</Button>
          </Tooltip>
          <Tooltip text="Right tooltip" side="right">
            <Button>Right</Button>
          </Tooltip>
        </div>
        <Tooltip text="Bottom tooltip" side="bottom">
          <Button>Bottom</Button>
        </Tooltip>
      </div>
    `
  })
}

export const WithOffset: Story = {
  render: () => ({
    components: { Tooltip, Button },
    template: `
      <div class="flex gap-12 p-20">
        <Tooltip text="20px offset" side="left" :side-offset="20" size="sm">
          <Button>Left 20px</Button>
        </Tooltip>
        <Tooltip text="20px offset" side="top" :side-offset="20" size="sm">
          <Button>Top 20px</Button>
        </Tooltip>
        <Tooltip text="Default offset" side="left" size="sm">
          <Button>Left default</Button>
        </Tooltip>
      </div>
    `
  })
}

export const Disabled: Story = {
  render: () => ({
    components: { Tooltip, Button },
    template: `
      <Tooltip text="You won't see this" :disabled="true">
        <Button>No tooltip</Button>
      </Tooltip>
    `
  })
}
