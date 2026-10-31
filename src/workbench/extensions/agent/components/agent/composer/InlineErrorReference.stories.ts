import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'

import '../../../agentPanel.css'

import type { AgentErrorContext } from '../../../types/agentErrorContext'
import InlineErrorReference from './InlineErrorReference.vue'

const meta: Meta<typeof InlineErrorReference> = {
  title: 'Agent/Composer/InlineErrorReference',
  component: InlineErrorReference,
  parameters: { layout: 'centered' },
  decorators: [
    () => ({
      template:
        '<div class="agent-scope w-96 rounded-lg border border-border-subtle bg-secondary-background p-3 font-inter text-[14px]/5 wrap-anywhere whitespace-pre-wrap text-base-foreground"><story />&#32;Can you fix this issue for me?</div>'
    })
  ],
  args: {
    removeLabel: 'Remove attached issue',
    countLabel: '3 problems',
    onRemove: fn()
  }
}

export default meta
type Story = StoryObj<typeof meta>

const warning: AgentErrorContext = {
  scope: 'card',
  count: 3,
  label: 'Missing Inputs',
  severity: 'warning',
  problems: [
    { category: 'missing_media', message: 'image missing' },
    { category: 'missing_media', message: 'mask missing' },
    { category: 'missing_media', message: 'video missing' }
  ]
}

const error: AgentErrorContext = {
  scope: 'card',
  count: 1,
  label: 'Execution failed',
  severity: 'error',
  problems: [{ category: 'execution_failure', message: 'RuntimeError: boom' }]
}

export const Warning: Story = { args: { context: warning } }

export const Error: Story = {
  args: { context: error, countLabel: '1 problem' }
}
