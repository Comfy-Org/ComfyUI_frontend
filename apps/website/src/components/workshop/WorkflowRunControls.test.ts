import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { WorkshopWorkflowError } from '@/config/workshop-workflow-api'
import type { WorkflowState } from '@/config/workshop-workflow-state'
import type { SavedWorkflow } from '@/config/workshop-workflow-storage'
import WorkflowRunControls from './WorkflowRunControls.vue'

const record: SavedWorkflow = {
  version: 2,
  cancelRequested: false,
  stage: 'run',
  runId: 'bafc696e-e5d4-42f1-9a3d-d01f82a0629b',
  workflowId: 'workflows/remove-background',
  definitionVersion: '1'
}
const states = {
  active: { phase: 'active', record },
  interrupted: {
    phase: 'interrupted',
    record,
    error: new WorkshopWorkflowError('network')
  }
} satisfies Record<string, WorkflowState>

describe('WorkflowRunControls', () => {
  it('labels Run for a signed-out visitor and sends them to sign in and come back', async () => {
    history.replaceState(null, '', '/hub/workflows/remove-background/?tab=api')
    const assign = vi.spyOn(location, 'assign').mockImplementation(() => {})
    onTestFinished(() => assign.mockRestore())
    render(WorkflowRunControls, {
      props: {
        state: { phase: 'idle' },
        signedIn: false,
        canStart: true,
        statusLabel: ''
      }
    })
    const destination =
      '/login/?returnTo=%2Fhub%2Fworkflows%2Fremove-background%2F%3Ftab%3Dapi'
    const run = await screen.findByRole('link', { name: 'Run' })
    await vi.waitFor(() => expect(run.getAttribute('href')).toBe(destination))

    await userEvent.setup().click(run)

    await vi.waitFor(() =>
      expect(assign).toHaveBeenCalledExactlyOnceWith(destination)
    )
  })

  // A turning loader on the button says the page is still watching the run.
  it.for([
    { phase: 'active' as const, spinners: 1, reconnects: 0 },
    { phase: 'interrupted' as const, spinners: 0, reconnects: 1 }
  ])('$phase keeps $spinners spinner', ({ phase, spinners, reconnects }) => {
    render(WorkflowRunControls, {
      props: {
        state: states[phase],
        signedIn: true,
        canStart: false,
        statusLabel: 'Connection interrupted'
      }
    })

    expect(screen.getByTestId('workflow-run')).toHaveTextContent(
      'Connection interrupted'
    )
    expect(screen.queryAllByTestId('run-button-spinner')).toHaveLength(spinners)
    expect(
      screen.queryAllByRole('button', { name: 'Reconnect to this run' })
    ).toHaveLength(reconnects)
  })
})
