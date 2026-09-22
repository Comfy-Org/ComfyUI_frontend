import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import WorkflowDemoDetail from './WorkflowDemoDetail.vue'
import { deploymentDemo } from '../../config/workflow-demo'

describe('deployment demo', () => {
  it('uses the shared tabs and copies deployment code with the current prompt', async () => {
    const user = userEvent.setup()
    render(WorkflowDemoDetail, { props: { workflow: deploymentDemo } })
    expect(
      within(screen.getByLabelText('Workflow sections'))
        .getAllByRole('button')
        .map((button) => button.textContent)
    ).toEqual(['playground', 'workflow', 'api'])
    await user.clear(
      screen.getByRole('textbox', { name: 'What should be removed?' })
    )
    await user.type(
      screen.getByRole('textbox', { name: 'What should be removed?' }),
      'Remove the glass and its reflection.'
    )
    await user.click(screen.getByRole('button', { name: 'api' }))
    expect(
      screen.getByText(/this interactive demo has no live endpoint/)
    ).toBeVisible()
    expect(screen.getByTestId('workflow-snippet')).toHaveTextContent(
      'Remove the glass and its reflection.'
    )
    await user.click(screen.getByRole('tab', { name: 'TypeScript' }))
    expect(screen.getByTestId('workflow-snippet')).toHaveTextContent(
      'client.submit(workflow, { apiKey })'
    )
    await user.click(screen.getByRole('button', { name: 'Copy snippet' }))
    expect(await navigator.clipboard.readText()).toBe(
      screen.getByTestId('workflow-snippet').textContent
    )
    await user.click(screen.getByRole('tab', { name: 'cURL' }))
    expect(screen.getByTestId('workflow-snippet')).toHaveTextContent(
      '/api/v2/jobs'
    )
  })

  it('previews an API copy without claiming a live deployment was created', async () => {
    const user = userEvent.setup()
    render(WorkflowDemoDetail, { props: { workflow: deploymentDemo } })
    expect(screen.getByRole('button', { name: 'workflow' })).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'View node graph' })
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Play example video' })
    ).toBeEnabled()
    expect(screen.getByLabelText('Example result video')).toHaveAttribute(
      'controls'
    )
    await user.click(screen.getByRole('button', { name: 'Copy to Comfy API' }))
    expect(
      screen.getByRole('dialog', { name: 'Copy to Comfy API' })
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Preview copy' }))
    expect(
      screen.getByRole('dialog', { name: 'Demo copy ready' })
    ).toBeVisible()
    expect(screen.getByText(/No deployment was created/)).toBeVisible()
  })

  it('requires demo sign-in, runs through startup, and shows a labeled sample result', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(WorkflowDemoDetail, { props: { workflow: deploymentDemo } })
    await user.click(screen.getByRole('button', { name: 'Sign in to run' }))
    expect(
      screen.getByRole('dialog', { name: 'Sign in to Comfy' })
    ).toBeVisible()
    await user.click(
      screen.getByRole('button', { name: 'Continue with demo account' })
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Run workflow' }))
    expect(screen.getByRole('status')).toHaveTextContent('Starting server')
    const output = within(screen.getByLabelText('Output preview'))
    expect(output.getByRole('status')).toHaveTextContent('Starting server')
    expect(
      output.getByRole('list', { name: 'Generation progress' })
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Play example video' })
    ).toBeNull()
    expect(screen.getByLabelText('Example result video')).not.toHaveAttribute(
      'controls'
    )
    expect(screen.getByLabelText('Example result video')).not.toBeVisible()
    await vi.advanceTimersByTimeAsync(2000)
    expect(screen.getByRole('status')).toHaveTextContent('Loading models')
    await vi.advanceTimersByTimeAsync(2500)
    expect(screen.getByRole('status')).toHaveTextContent('Generating')
    expect(screen.getByLabelText('Example result video')).not.toBeVisible()
    await vi.advanceTimersByTimeAsync(4000)
    expect(screen.getByRole('status')).toHaveTextContent('Ready')
    expect(
      screen.queryByRole('list', { name: 'Generation progress' })
    ).toBeNull()
    expect(output.queryByRole('status')).toBeNull()
    expect(screen.getByLabelText('Sample result video')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Play result video' })
    ).toBeEnabled()
    expect(screen.getByLabelText('Sample result video')).toHaveAttribute(
      'controls'
    )
    expect(
      screen.getByText(
        /prerecorded sample did not process your input or prompt/
      )
    ).toBeVisible()
  })

  it('cancels a run without displaying a late result and permits another run', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(WorkflowDemoDetail, { props: { workflow: deploymentDemo } })
    await user.click(screen.getByRole('button', { name: 'Sign in to run' }))
    await user.click(
      screen.getByRole('button', { name: 'Continue with demo account' })
    )
    await user.click(screen.getByRole('button', { name: 'Run workflow' }))
    await user.click(screen.getByRole('button', { name: 'Cancel run' }))
    await vi.advanceTimersByTimeAsync(15000)
    expect(screen.queryByLabelText('Sample result video')).toBeNull()
    expect(screen.getByRole('button', { name: 'Run workflow' })).toBeEnabled()
  })
})
