import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'

import type { AgentErrorContext } from '../../../types/agentErrorContext'
import InlineErrorReference from './InlineErrorReference.vue'

function context(
  overrides: Partial<AgentErrorContext> = {}
): AgentErrorContext {
  return {
    scope: 'card',
    count: 1,
    label: 'Execution failed',
    severity: 'error',
    problems: [{ category: 'execution_failure', message: 'boom' }],
    ...overrides
  }
}

function renderChip(ctx: AgentErrorContext) {
  return render(InlineErrorReference, {
    props: {
      context: ctx,
      removeLabel: 'Remove attached issue',
      countLabel: ''
    },
    global: { plugins: [i18n] }
  })
}

describe('InlineErrorReference', () => {
  it('renders an outline error icon and the label for error severity', () => {
    renderChip(context())

    expect(screen.getByTestId('error-reference-icon')).toHaveClass(
      'icon-[lucide--circle-alert]',
      'size-3',
      'text-destructive-background'
    )
    expect(screen.getByText('Execution failed')).toBeVisible()
  })

  it('renders an outline warning icon and the count for warning severity', () => {
    renderChip(
      context({ severity: 'warning', label: 'Missing Inputs', count: 3 })
    )

    expect(screen.getByTestId('error-reference-icon')).toHaveClass(
      'icon-[lucide--triangle-alert]',
      'size-3',
      'text-warning-foreground'
    )
    expect(screen.getByTestId('error-reference-count')).toHaveTextContent('3')
  })

  it('emits remove when the remove affordance is clicked', async () => {
    const { emitted } = renderChip(context())

    await userEvent.click(screen.getByTestId('error-reference-remove'))

    expect(emitted().remove).toHaveLength(1)
  })
})
