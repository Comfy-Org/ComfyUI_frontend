import type { Meta, StoryObj } from '@storybook/vue3-vite'

import DropdownMenuItem from '@/components/ui/dropdown-menu/DropdownMenuItem.vue'

import MoreButton from './MoreButton.vue'

const meta: Meta<typeof MoreButton> = {
  title: 'Components/Button/MoreButton',
  component: MoreButton,
  parameters: {
    layout: 'centered'
  },
  argTypes: {}
}
export default meta

type Story = StoryObj<typeof MoreButton>

export const Basic: Story = {
  render: () => ({
    components: { MoreButton, DropdownMenuItem },
    template: `
      <div style="height: 200px; display: flex; align-items: center; justify-content: center;">
        <MoreButton>
          <DropdownMenuItem>
            <template #icon><i class="icon-[lucide--download]" /></template>
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem>
            <template #icon><i class="icon-[lucide--scroll-text]" /></template>
            Profile
          </DropdownMenuItem>
        </MoreButton>
      </div>
    `
  })
}
