import type { Meta, StoryObj } from '@storybook/vue3-vite'

import MarkdownStream from './MarkdownStream.vue'

const meta: Meta<typeof MarkdownStream> = {
  title: 'Workbench/Agent/MarkdownStream',
  component: MarkdownStream,
  parameters: { layout: 'centered' },
  globals: { theme: 'dark' }
}

export default meta
type Story = StoryObj<typeof meta>

const renderAtPanelWidth: Story['render'] = (args) => ({
  components: { MarkdownStream },
  setup: () => ({ args }),
  template: '<div class="w-[372px]"><MarkdownStream v-bind="args" /></div>'
})

// DES-779. A reply pointing the user at a canvas action renders the shortcut as
// keycaps. In the running app the keys come from that user's own bindings; here
// the keybinding store is empty, so the keys the text carries are what render,
// which is the fallback the component uses for an unbound command.
export const KeyboardShortcut: Story = {
  args: {
    text: 'Both upscalers are wired. Select the second one and press Ctrl+B to bypass it, then run again.'
  },
  render: renderAtPanelWidth
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
  },
  render: renderAtPanelWidth
}

// A keycap beside the inline-code styling it borrows from, so the two stay
// distinguishable.
export const ShortcutBesideCode: Story = {
  args: {
    text: 'The prompt lives on `6.text`. Press Ctrl+Enter when you are happy with it.'
  },
  render: renderAtPanelWidth
}
