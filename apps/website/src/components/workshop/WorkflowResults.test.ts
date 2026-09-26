import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'

import {
  createWorkflowApi,
  WorkshopWorkflowError
} from '../../config/workshop-workflow-api'
import { workflowDetailsBySlug } from '../../config/workshop-workflow-content'
import { createWorkflowController } from '../../config/workshop-workflow-controller'
import type { WorkflowState } from '../../config/workshop-workflow-state'
import { workflowStorage } from '../../config/workshop-workflow-storage'
import { captureWorkshopEvent } from '../../scripts/posthog'
import { workshopModelAnalytics } from '../../scripts/workshop-analytics'
import WorkflowResults from './WorkflowResults.vue'

vi.mock(import('../../scripts/posthog'))

const id = 'bafc696e-e5d4-42f1-9a3d-d01f82a0629b'

function completed(shortUrl: string) {
  return Response.json({
    id,
    status: 'completed',
    create_time: Date.now(),
    update_time: Date.now(),
    outputs: {
      '18': { images: [{ filename: 'result.png', short_url: shortUrl }] }
    }
  })
}

async function mountResult(trackDelivery = false) {
  const model = workflowDetailsBySlug.get('workflows/remove-background')
  assert(model)
  const state = shallowRef<WorkflowState>({ phase: 'idle' })
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(Response.json({ prompt_id: id }))
    .mockResolvedValueOnce(completed('/api/s/expired'))
  const controller = createWorkflowController({
    model,
    api: createWorkflowApi({
      token: 'session',
      definition: model.workflow,
      fetch
    }),
    storage: workflowStorage(sessionStorage, 'download-test', model.workflowId),
    uploadFile: async () => 'input.webp',
    onChange: (next) => {
      state.value = next
    }
  })
  onTestFinished(() => controller.dispose())
  render(
    defineComponent({
      setup: () => () =>
        h(WorkflowResults, {
          model,
          state: state.value,
          exampleIndex: 0,
          busy: false,
          statusLabel: '',
          canStart: true,
          analytics: trackDelivery
            ? {
                ...workshopModelAnalytics(model),
                attempt_id: 'attempt-1',
                user_id: 'user-1',
                workspace_id: 'workspace-1'
              }
            : undefined,
          refreshOutput: controller.refreshOutput
        })
    })
  )
  await controller.start({ image: 'https://example.com/input.webp' })
  return { fetch, state, refreshOutput: controller.refreshOutput }
}

describe('WorkflowResults', () => {
  it('reports delivery only after the actual generated preview loads and once across link refresh', async () => {
    const f = await mountResult(true)
    expect(captureWorkshopEvent).not.toHaveBeenCalled()
    await fireEvent.load(screen.getByRole('img', { name: 'Output' }))
    expect(captureWorkshopEvent).toHaveBeenCalledExactlyOnceWith({
      name: 'delivery_finished',
      properties: expect.objectContaining({
        page_type: 'workflow',
        render_engine: 'cloud',
        workflow_id: 'workflows/remove-background',
        attempt_id: 'attempt-1',
        request_id: id,
        status: 'succeeded',
        output_kind: 'image'
      })
    })
    assert(f.state.value.phase === 'settled')
    const output = f.state.value.observation.outputs[0]
    assert(output)
    f.fetch.mockResolvedValueOnce(completed('/api/s/refreshed'))
    await f.refreshOutput(output.id)
    await fireEvent.load(screen.getByRole('img', { name: 'Output' }))
    expect(captureWorkshopEvent).toHaveBeenCalledOnce()
  })

  it.for(['/api/s/refreshed', '/api/s/expired'])(
    'refreshes a failed download to %s without losing the loaded preview or submitting another job',
    async (refreshed) => {
      const f = await mountResult()
      const user = userEvent.setup()
      const download = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(new Response(null, { status: 404 }))
      vi.stubGlobal('fetch', download)
      const open = vi.spyOn(window, 'open').mockReturnValue(null)
      const preview = screen.getByRole('img', { name: 'Output' })
      const original = preview.getAttribute('src')
      await fireEvent.load(preview)
      f.fetch.mockResolvedValueOnce(new Response(null, { status: 503 }))

      await user.click(screen.getByRole('link', { name: 'Download' }))
      await screen.findByRole('link', { name: 'Refresh download link' })
      await waitFor(() => expect(f.fetch).toHaveBeenCalledTimes(3))
      expect(download).toHaveBeenCalledWith(
        original,
        expect.objectContaining({ credentials: 'omit' })
      )
      expect(open).not.toHaveBeenCalled()
      expect(preview).toHaveAttribute('src', original)
      expect(f.state.value.phase).toBe('settled')

      f.fetch.mockResolvedValueOnce(completed(refreshed))
      await user.click(
        screen.getByRole('link', { name: 'Refresh download link' })
      )
      expect(
        await screen.findByRole('link', { name: 'Download' })
      ).toHaveAttribute('href', expect.stringContaining(refreshed))
      expect(screen.getByRole('img', { name: 'Output' })).toHaveAttribute(
        'src',
        expect.stringContaining(refreshed)
      )
      expect(
        f.fetch.mock.calls.map(([url, init]) => [
          new URL(String(url)).pathname,
          init?.method
        ])
      ).toEqual([
        ['/api/prompt', 'POST'],
        [`/api/jobs/${id}`, 'GET'],
        [`/api/jobs/${id}`, 'GET'],
        [`/api/jobs/${id}`, 'GET']
      ])
    }
  )

  it('keeps the direct download fallback when the browser cannot fetch the media', async () => {
    const f = await mountResult()
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof globalThis.fetch>()
        .mockRejectedValue(new TypeError('Failed to fetch'))
    )
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const url = screen.getByRole('img', { name: 'Output' }).getAttribute('src')
    await userEvent
      .setup()
      .click(screen.getByRole('link', { name: 'Download' }))
    expect(
      await screen.findByRole('link', { name: 'Open output' })
    ).toHaveAttribute('href', url)
    expect(open).toHaveBeenCalledWith(url, '_blank', 'noopener')
    expect(f.fetch).toHaveBeenCalledTimes(2)
    expect(f.state.value.phase).toBe('settled')
    expect(captureWorkshopEvent).toHaveBeenCalledExactlyOnceWith({
      name: 'output_download_clicked',
      properties: expect.objectContaining({
        page_type: 'workflow',
        render_engine: 'cloud',
        output_kind: 'image'
      })
    })
  })

  it('automatically refreshes a failed preview once and keeps manual refresh available', async () => {
    const f = await mountResult()
    f.fetch.mockImplementation(async () => completed('/api/s/expired'))
    await fireEvent.error(screen.getByRole('img', { name: 'Output' }))
    await waitFor(() => expect(f.fetch).toHaveBeenCalledTimes(3))
    await fireEvent.error(screen.getByRole('img', { name: 'Output' }))
    expect(f.fetch).toHaveBeenCalledTimes(3)
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Refresh download link' }))
    await waitFor(() => expect(f.fetch).toHaveBeenCalledTimes(4))
    expect(f.state.value.phase).toBe('settled')
  })
})

// A request Cloud turns down used to leave the panel showing the example: a
// picture of a successful run, beside a form that had just been refused.
describe('a refused request', () => {
  function mountRefused(code: string) {
    const model = workflowDetailsBySlug.get('workflows/remove-background')
    assert(model)
    render(WorkflowResults, {
      props: {
        model,
        state: {
          phase: 'failed',
          error: new WorkshopWorkflowError(
            code as ConstructorParameters<typeof WorkshopWorkflowError>[0]
          )
        } satisfies WorkflowState,
        exampleIndex: 0,
        busy: false,
        statusLabel: '',
        canStart: true,
        refreshOutput: async () => undefined
      }
    })
  }

  it('stands the refusal up in the output panel instead of the example', () => {
    mountRefused('insufficient_credits')

    // Shown and also announced, so the sentence is on the page more than once.
    expect(
      screen.getAllByText('Not enough credits. Add credits to continue.').length
    ).toBeGreaterThan(0)
    expect(screen.queryByText('An example from this template.')).toBeNull()
  })

  // The panel already knows how to send a reader to buy credits; it was never
  // being told that was the refusal.
  it('offers the way out the refusal has', () => {
    mountRefused('insufficient_credits')

    expect(screen.getByRole('button', { name: /credits/i })).toBeTruthy()
  })

  // A refusal the panel has no sentence for is said beside the form instead.
  // The panel then shows nothing — not the example, which is a picture of a run
  // that worked.
  it('shows nothing rather than the example for a refusal it cannot word', () => {
    mountRefused('access_denied')

    expect(screen.queryByText('An example from this template.')).toBeNull()
    expect(screen.getByText('Your output will appear here.')).toBeTruthy()
  })
})

// A run the reader stopped is the one state they caused, and the panel used to
// go blank for it.
describe('a cancelled run', () => {
  const runId = '9a5f2f5c-6a26-4d1e-90f4-1f7f0a0d5b21'

  function mountCancelled() {
    const model = workflowDetailsBySlug.get('workflows/remove-background')
    assert(model)
    const at = new Date(0).toISOString()
    render(WorkflowResults, {
      props: {
        model,
        state: {
          phase: 'settled',
          record: {
            version: 2,
            stage: 'run',
            runId,
            workflowId: model.workflowId,
            definitionVersion: model.workflow.definitionVersion,
            cancelRequested: true
          },
          observation: {
            run: {
              id: runId,
              workflowId: model.workflowId,
              definitionVersion: model.workflow.definitionVersion,
              state: 'cancelled',
              outputState: 'pending',
              createdAt: at,
              updatedAt: at
            },
            outputs: []
          }
        } satisfies WorkflowState,
        exampleIndex: 0,
        busy: false,
        statusLabel: '',
        canStart: true,
        refreshOutput: async () => undefined
      }
    })
  }

  it('says the run was cancelled instead of emptying the panel', () => {
    mountCancelled()

    expect(
      screen.getAllByText('This run was cancelled before it finished.').length
    ).toBeGreaterThan(0)
    expect(screen.getByTestId('playground-output')).toHaveAttribute(
      'data-state',
      'cancelled'
    )
  })

  it('offers the run again', () => {
    mountCancelled()

    expect(screen.getByRole('button', { name: 'Run again' })).toBeTruthy()
  })

  // The panel says it now, and the sentence beside it went on advising a check
  // of Cloud for a status Cloud had already given.
  it('does not also say it under the panel', () => {
    mountCancelled()

    expect(
      screen.queryByText(/Check Cloud for the final job status/)
    ).toBeNull()
  })
})
