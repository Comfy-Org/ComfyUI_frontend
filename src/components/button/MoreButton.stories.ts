import type { Meta, StoryObj } from '@storybook/vue3-vite'

import IconTextButton from './IconTextButton.vue'
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
    components: { MoreButton, IconTextButton },
    template: `
      <div style="height: 200px; display: flex; align-items: center; justify-content: center;">
        <MoreButton>
          <template #default="{ close }">
            <IconTextButton
              type="transparent"
              label="Settings"
              @click="() => { close() }"
            >
              <template #icon>
                <i class="icon-[lucide--download] size-4" />
              </template>
            </IconTextButton>

            <IconTextButton
              type="transparent"
              label="Profile"
              @click="() => { close() }"
            >
              <template #icon>
                <i class="icon-[lucide--scroll-text] size-4" />
              </template>
            </IconTextButton>
          </template>
        </MoreButton>
      </div>
    `
  })
}
