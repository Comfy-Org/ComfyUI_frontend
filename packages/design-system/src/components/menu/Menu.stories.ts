import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'
import { ref } from 'vue'

import Button from '@comfyorg/design-system/button/Button'

import Menu from './Menu.vue'
import MenuGroup from './MenuGroup.vue'
import MenuItem from './MenuItem.vue'
import MenuLabel from './MenuLabel.vue'
import MenuSeparator from './MenuSeparator.vue'

const meta: Meta<typeof Menu> = {
  title: 'Components/Menu',
  component: Menu,
  tags: ['autodocs'],
  args: {
    items: [
      { label: 'Open', icon: 'icon-[lucide--folder-open]', command: fn() },
      { label: 'Disabled', disabled: true },
      { separator: true },
      { label: 'More', items: [{ label: 'Nested item', command: fn() }] }
    ]
  },
  render: (args) => ({
    components: { Button, Menu },
    setup: () => ({ args, open: ref(false) }),
    template:
      '<Menu v-bind="args" v-model:open="open"><template #trigger><Button>Open menu</Button></template></Menu>'
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Disabled: Story = {
  args: { items: [{ label: 'Disabled item', disabled: true }] }
}
export const Nested: Story = {
  args: {
    items: [{ label: 'Parent', items: [{ label: 'Child', command: fn() }] }]
  }
}

export const Badges: Story = {
  args: {
    items: [
      { label: 'Enter node graph', badge: 'New', command: fn() },
      { label: 'Preview', badge: 'Beta', command: fn() },
      { label: 'Settings', command: fn() }
    ]
  }
}

export const Grouped: Story = {
  args: { items: undefined },
  render: (args) => ({
    components: {
      Button,
      Menu,
      MenuGroup,
      MenuItem,
      MenuLabel,
      MenuSeparator
    },
    setup: () => ({ args, open: ref(false) }),
    template: `
      <Menu v-bind="args" v-model:open="open">
        <template #trigger><Button>Open menu</Button></template>
        <MenuGroup aria-labelledby="story-group-1">
          <MenuLabel id="story-group-1">Your skills</MenuLabel>
          <MenuItem>my-render-defaults</MenuItem>
        </MenuGroup>
        <MenuSeparator />
        <MenuGroup aria-labelledby="story-group-2">
          <MenuLabel id="story-group-2">Comfy skills</MenuLabel>
          <MenuItem>batch-generation</MenuItem>
        </MenuGroup>
      </Menu>
    `
  })
}
