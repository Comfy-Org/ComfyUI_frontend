import type { Meta, StoryObj } from '@storybook/vue3-vite'

import '../../../agentPanel.css'

import type { AgentErrorContext } from '../../../types/agentErrorContext'
import ErrorContextChip from './ErrorContextChip.vue'

const meta: Meta<typeof ErrorContextChip> = {
  title: 'Agent/Composer/ErrorContextChip',
  component: ErrorContextChip,
  parameters: { layout: 'centered' },
  decorators: [
    () => ({
      template:
        '<div class="agent-scope flex w-96 flex-col rounded-lg border border-border-subtle bg-secondary-background"><story /><div class="px-3 pt-2 pb-3 text-sm text-base-foreground">Can you fix this issue for me?</div></div>'
    })
  ]
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

export const Error: Story = { args: { context: error } }
