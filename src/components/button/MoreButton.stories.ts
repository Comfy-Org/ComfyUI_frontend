import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { Download, ScrollText } from 'lucide-vue-next'

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
    components: { MoreButton, IconTextButton, Download, ScrollText },
    template: `
      <div style="height: 200px; display: flex; align-items: center; justify-content: center;">
        <MoreButton>
          <template #default="{ close }">
            <IconTextButton
              type="secondary"
              label="Settings"
              @click="() => { close() }"
            >
              <template #icon>
                <Download />
              </template>
            </IconTextButton>

            <IconTextButton
              type="primary"
              label="Profile"
              @click="() => { close() }"
            >
              <template #icon>
                <ScrollText />
              </template>
            </IconTextButton>
          </template>
        </MoreButton>
      </div>
    `
  })
}
