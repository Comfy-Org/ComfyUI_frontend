import type {
  ComponentPropsAndSlots,
  Meta,
  StoryObj
} from '@storybook/vue3-vite'

import Message from './Message.vue'

const meta: Meta<ComponentPropsAndSlots<typeof Message>> = {
  title: 'Components/Message',
  component: Message,
  tags: ['autodocs'],
  args: { severity: 'info' }
}

export default meta
type Story = StoryObj<ComponentPropsAndSlots<typeof Message>>

export const Default: Story = {
  render: (args: ComponentPropsAndSlots<typeof Message>) => ({
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
        <Message severity="warning">Warning message</Message>
        <Message severity="info">Information message</Message>
        <Message severity="success">Success message</Message>
      </div>`
  })
}

export const Closable: Story = {
  args: { closable: true, closeLabel: 'Close' },
  render: (args: ComponentPropsAndSlots<typeof Message>) => ({
    components: { Message },
    setup: () => ({ args }),
    template: `
      <Message v-bind="args">
        <template #icon><i class="pi pi-info-circle" /></template>
        Dismiss this message.
      </Message>`
  })
}
