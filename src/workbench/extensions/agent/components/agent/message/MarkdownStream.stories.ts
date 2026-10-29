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

export const ShortcutInAnotherLanguage: Story = {
  args: {
    text: '选中第二个放大节点后按 Ctrl+B 旁路它，然后重新运行。'
  }
}

export const ShortcutSplitByEmphasis: Story = {
  args: {
    text: 'Press **Ctrl**+**B** to bypass the node.'
  }
}

export const CrossPlatformShortcut: Story = {
  args: {
    text: 'Select the node and press Ctrl/Cmd+B to bypass it.'
  }
}

export const TwoShortcutsInOneSentence: Story = {
  args: {
    text: 'Copy the node with Ctrl+C + Ctrl+V, then press Alt++ to zoom in on it.'
  }
}
