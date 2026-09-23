import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { ComposerPrompt } from '../../../types/composerPrompt'

import '../../../agentPanel.css'

import InlinePromptEditor from './InlinePromptEditor.vue'

const prompt: ComposerPrompt = {
  text: 'Use  with  and compare to .',
  references: [
    {
      kind: 'node',
      node: {
        id: '12',
        title: 'A selected node with a long descriptive title'
      },
      scope: 'story-workflow',
      textOffset: 4
    },
    {
      kind: 'asset',
      attachment: {
        id: 'asset-1',
        name: 'a-long-uploaded-reference-image-name.png',
        ref: 'reference.png'
      },
      textOffset: 10
    },
    {
      kind: 'workflow',
      id: 'missing-workflow',
      name: 'Unavailable portrait workflow with a long name',
      unavailable: true,
      textOffset: 26
    }
  ]
}

const meta: Meta<typeof InlinePromptEditor> = {
  title: 'Agent/Composer/InlinePromptEditor',
  component: InlinePromptEditor,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [
    () => ({
      template:
        '<div class="agent-scope w-100 rounded-lg bg-secondary-background p-3"><story /></div>'
    })
  ],
  args: {
    label: 'Describe what you want to build'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const References: Story = {
  args: { modelValue: prompt }
}
