import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Message from './Message.vue'

const meta: Meta<typeof Message> = {
  title: 'Components/Message',
  component: Message,
  tags: ['autodocs'],
  args: { severity: 'info', closeLabel: 'Close' }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => ({
    components: { Message },
    setup: () => ({ args }),
    template: '<Message v-bind="args">A useful inline message.</Message>'
  })
}

export const AllSeverities: Story = {
  render: () => ({
    components: { Message },
    template: `
      <div class="flex w-96 flex-col gap-3">
        <Message severity="error" close-label="Close">Error message</Message>
        <Message severity="warning" close-label="Close">Warning message</Message>
        <Message severity="info" close-label="Close">Information message</Message>
        <Message severity="success" close-label="Close">Success message</Message>
      </div>`
  })
}

export const Closable: Story = {
  args: { closable: true },
  render: (args) => ({
    components: { Message },
    setup: () => ({ args }),
    template: `
      <Message v-bind="args">
        <template #icon><i class="pi pi-info-circle" /></template>
        Dismiss this message.
      </Message>`
  })
}
