import type { Meta, StoryObj } from '@storybook/vue3-vite'

import MarkdownStream from './MarkdownStream.vue'

const meta: Meta<typeof MarkdownStream> = {
  title: 'Workbench/Agent/MarkdownStream',
  component: MarkdownStream,
  parameters: { layout: 'centered' },
  render: (args) => ({
    components: { MarkdownStream },
    setup: () => ({ args }),
    template: '<div class="w-[372px]"><MarkdownStream v-bind="args" /></div>'
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const KeyboardShortcut: Story = {
  args: {
    text: 'Both upscalers are wired. Select the second one and press Ctrl+B to bypass it, then run again.'
  }
}

export const SeveralShortcuts: Story = {
  args: {
    text: [
      'A few things you can do from here:',
      '',
      '- Ctrl+B skips a node without deleting it',
      '- Ctrl+M mutes it instead',
      '- Ctrl+Shift+E turns the selection into a subgraph',
      '- Ctrl+Enter runs the graph'
    ].join('\n')
  }
}

export const ShortcutBesideCode: Story = {
  args: {
    text: 'The prompt lives on `6.text`. Press Ctrl+Enter when you are happy with it.'
  }
}
