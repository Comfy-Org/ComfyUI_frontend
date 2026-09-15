import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Message from './Message.vue'

const meta = {
  title: 'Components/Message',
  component: Message,
  tags: ['autodocs'],
  args: { severity: 'info' }
} satisfies Meta<typeof Message>

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
        <Message severity="error">Error message</Message>
        <Message severity="warn">Warning message</Message>
        <Message severity="info">Information message</Message>
        <Message severity="success">Success message</Message>
      </div>`
  })
}

export const Closable: Story = {
  args: { closable: true },
  render: (args) => ({
    components: { Message },
    setup: () => ({ args }),
    template: '<Message v-bind="args">Dismiss this message.</Message>'
  })
}
