import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { subscribeToWorkshopBuyCredits } from '@/config/workshop-buy-credits'
import { useWorkshopSession } from '@/config/workshop-session-state'
import type { WorkflowCreditsGate } from '@/lib/workshop/workflow-credits-gate'
import WorkflowCreditsGuard from './WorkflowCreditsGuard.vue'

vi.mock(import('@/config/workshop-session-state'))
vi.mock(import('@/config/workshop-credits'))

function renderGuard(gate: WorkflowCreditsGate) {
  render(WorkflowCreditsGuard, {
    props: { gate, workspaceName: 'Studio team' },
    slots: { default: '<button data-testid="workflow-run">Run</button>' }
  })
  return screen.getByTestId('workflow-run')
}

describe('WorkflowCreditsGuard', () => {
  it.for([
    { gate: 'run' as const, label: 'Run', note: undefined },
    {
      gate: 'noCredits' as const,
      label: 'Add credits',
      note: 'Not enough credits in Studio team.'
    },
    {
      gate: 'memberNoCredits' as const,
      label: 'Switch to personal workspace',
      note: 'Studio team has used all its credits.'
    }
  ])('offers $label for $gate', ({ gate, label, note }) => {
    expect(renderGuard(gate)).toHaveAccessibleName(label)
    expect(screen.getAllByRole('button')).toHaveLength(1)
    if (note) expect(screen.getByText(note, { exact: false })).toBeVisible()
  })

  it('opens the credits purchase', async () => {
    const purchase = vi.fn()
    onTestFinished(subscribeToWorkshopBuyCredits(purchase))

    await userEvent.setup().click(renderGuard('noCredits'))

    expect(purchase).toHaveBeenCalledOnce()
  })

  it('moves a team member whose workspace is out of credits to their own', async () => {
    await userEvent.setup().click(renderGuard('memberNoCredits'))

    expect(useWorkshopSession().remint).toHaveBeenCalledOnce()
  })
})
