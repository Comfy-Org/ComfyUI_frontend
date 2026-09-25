import type { JobDetailResponse } from '@comfyorg/ingest-types'
import { render, waitFor } from '@testing-library/vue'
import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'
import { computed, defineComponent, h, ref, shallowRef } from 'vue'

import type { WorkflowWorkshopModelDetail } from '../config/models-catalogue'
import { markWorkshopCreditsDirty } from '../config/workshop-credits'
import { initialWorkshopPageState } from '../config/workshop-page-state'
import type { FormValues } from '../config/workshop-playground'
import { restoreFormValues } from '../config/workshop-playground'
import type { WorkshopSession } from '../config/workshop-session-state'
import { useWorkshopSession } from '../config/workshop-session-state'
import { workflowDetailsBySlug } from '../config/workshop-workflow-content'
import type { SavedWorkflow } from '../config/workshop-workflow-storage'
import { workflowStorage } from '../config/workshop-workflow-storage'
import { createWorkflowUploader } from '../config/workshop-workflow-upload'
import { captureWorkshopEvent } from '../scripts/posthog'
import { useWorkflowFormDraft } from './useWorkflowFormDraft'
import { useWorkflowRun } from './useWorkflowRun'

vi.mock(import('../config/workshop-session-state'))
vi.mock(import('../config/workshop-credits'))
vi.mock(import('../config/workshop-workflow-upload'))
vi.mock(import('../scripts/posthog'))

const runId = 'bafc696e-e5d4-42f1-9a3d-d01f82a0629b'
const input = { image: 'https://storage.googleapis.com/inputs/canonical' }

function credential(
  uid = 'alice',
  workspaceId = 'workspace-a'
): WorkshopSession {
  return {
    uid,
    token: `${uid}:${workspaceId}:token`,
    expiresAt: Date.now() + 60_000,
    workspace: { id: workspaceId, name: workspaceId, type: 'personal' },
    role: 'owner',
    permissions: []
  }
}

function authoredWorkflow(slug = 'workflows/remove-background') {
  const model = workflowDetailsBySlug.get(slug)
  if (!model) throw new Error('Missing authored test workflow')
  return model
}

function callerScope(owner: WorkshopSession) {
  return JSON.stringify([owner.uid, owner.workspace.id])
}

function mountWorkflow(model: WorkflowWorkshopModelDetail, scope: string) {
  const initial = initialWorkshopPageState(model)
  const values = ref(initial.values)
  let captured: ReturnType<typeof useWorkflowRun> | undefined
  const view = render(
    defineComponent({
      setup() {
        const workflow = useWorkflowRun(model, scope, (inputs) => {
          values.value = {
            ...values.value,
            ...restoreFormValues(initial.schema, inputs)
          }
        })
        useWorkflowFormDraft(
          model.slug,
          scope,
          ref(initial.schema),
          values,
          ref(false)
        )
        captured = workflow
        return () => h('output', workflow.state.value.phase)
      }
    })
  )
  assert.exists(captured)
  return { ...view, workflow: captured, values }
}

function fixture(model = authoredWorkflow()) {
  const owner = credential()
  const current = shallowRef<WorkshopSession | undefined>(owner)
  const session = useWorkshopSession()
  session.session = computed(() => current.value)
  vi.mocked(session.ensureFresh).mockResolvedValue({
    status: 'ok',
    session: owner
  })
  vi.mocked(session.remint).mockResolvedValue({ status: 'ok', session: owner })
  vi.mocked(createWorkflowUploader).mockReturnValue(
    async () => 'canonical-image.webp'
  )
  const fetch = vi.fn<typeof globalThis.fetch>()
  vi.stubGlobal('fetch', fetch)
  const scope = callerScope(owner)
  const view = mountWorkflow(model, scope)
  return { ...view, model, owner, current, session, fetch, scope }
}

function finished(): JobDetailResponse {
  return {
    id: runId,
    status: 'completed',
    create_time: Date.now(),
    update_time: Date.now(),
    outputs: {
      '18': {
        images: [{ filename: 'result.png', short_url: '/api/s/current-result' }]
      }
    }
  }
}

describe('workflow page caller lifecycle', () => {
  it('reports one Cloud attempt without inputs and does not count link refresh or restored jobs as new runs', async () => {
    const f = fixture()
    f.fetch
      .mockResolvedValueOnce(Response.json({ prompt_id: runId }))
      .mockResolvedValue(Response.json(finished()))
    await f.workflow.start(input)
    const started = vi.mocked(captureWorkshopEvent).mock.calls.at(0)?.[0]
    expect(started).toMatchObject({
      name: 'run_started',
      properties: {
        page_type: 'workflow',
        render_engine: 'cloud',
        workflow_id: f.model.workflowId,
        user_id: f.owner.uid,
        workspace_id: f.owner.workspace.id,
        attempt_id: expect.any(String)
      }
    })
    expect(captureWorkshopEvent).toHaveBeenLastCalledWith({
      name: 'run_finished',
      properties: {
        ...started?.properties,
        request_id: runId,
        status: 'succeeded',
        duration_ms: expect.any(Number),
        output_count: 1
      }
    })
    expect(
      JSON.stringify(vi.mocked(captureWorkshopEvent).mock.calls)
    ).not.toMatch(/canonical|result\.png|token|https:/)
    vi.mocked(captureWorkshopEvent).mockClear()
    f.fetch.mockImplementation(async () => Response.json(finished()))
    const output = f.workflow.observation.value?.outputs[0]
    assert(output)
    await f.workflow.refreshOutput(output.id)
    f.unmount()
    const restored = mountWorkflow(f.model, f.scope)
    await waitFor(() =>
      expect(restored.workflow.state.value.phase).toBe('settled')
    )
    expect(captureWorkshopEvent).not.toHaveBeenCalled()
  })

  it.for([
    { name: 'a run that just finished', age: 0, marks: 1 },
    { name: 'a run that finished long ago', age: 10 * 60_000, marks: 0 }
  ])('marks the credits dirty once for $name', async ({ age, marks }) => {
    const f = fixture()
    const job = { ...finished(), update_time: Date.now() - age }
    f.fetch
      .mockResolvedValueOnce(Response.json({ prompt_id: runId }))
      .mockResolvedValue(Response.json(job))

    await f.workflow.start(input)
    await f.workflow.retryDelivery()

    expect(f.workflow.state.value.phase).toBe('settled')
    expect(markWorkshopCreditsDirty).toHaveBeenCalledTimes(marks)
  })

  it('reports form validation separately from generation attempts', async () => {
    const f = fixture()
    await f.workflow.start({ image: '' })
    expect(captureWorkshopEvent).toHaveBeenCalledExactlyOnceWith({
      name: 'run_validation_failed',
      properties: expect.objectContaining({
        page_type: 'workflow',
        field_error_codes: ['required'],
        field_error_names: ['image']
      })
    })
    expect(f.workflow.state.value.phase).toBe('failed')
    expect(f.fetch).not.toHaveBeenCalled()
  })

  it('records a credit refusal without exposing the Cloud error body', async () => {
    const f = fixture()
    f.fetch.mockResolvedValueOnce(
      new Response('private provider details', { status: 402 })
    )
    await f.workflow.start(input)
    expect(captureWorkshopEvent).toHaveBeenLastCalledWith({
      name: 'run_finished',
      properties: expect.objectContaining({
        page_type: 'workflow',
        status: 'failed',
        reason: 'noCredits',
        workflow_error_code: 'insufficient_credits',
        http_status: 402
      })
    })
    expect(
      JSON.stringify(vi.mocked(captureWorkshopEvent).mock.calls)
    ).not.toContain('private')
  })

  it('reports cancellation during upload without claiming a Cloud job was cancelled', async () => {
    const f = fixture()
    const uploaded = Promise.withResolvers<string>()
    const requested = Promise.withResolvers<void>()
    vi.mocked(createWorkflowUploader).mockReturnValue(async () => {
      requested.resolve()
      return uploaded.promise
    })
    const pending = f.workflow.start(input)
    onTestFinished(async () => {
      uploaded.resolve('input.webp')
      await pending
    })
    await requested.promise
    await f.workflow.cancel()
    expect(captureWorkshopEvent).toHaveBeenLastCalledWith({
      name: 'run_finished',
      properties: expect.objectContaining({
        status: 'cancelled',
        page_type: 'workflow'
      })
    })
    const last = vi.mocked(captureWorkshopEvent).mock.calls.at(-1)?.[0]
    expect(last?.properties).not.toHaveProperty('request_id')
    expect(f.fetch).not.toHaveBeenCalled()
    uploaded.resolve('input.webp')
    await pending
    expect(captureWorkshopEvent).toHaveBeenCalledTimes(2)
  })

  it.for(['failed', 'cancelled'] as const)(
    'records a confirmed Cloud job %s outcome',
    async (status) => {
      const f = fixture()
      f.fetch
        .mockResolvedValueOnce(Response.json({ prompt_id: runId }))
        .mockResolvedValueOnce(
          Response.json({ ...finished(), status, outputs: {} })
        )
      await f.workflow.start(input)
      expect(captureWorkshopEvent).toHaveBeenLastCalledWith({
        name: 'run_finished',
        properties: expect.objectContaining({
          status,
          request_id: runId,
          page_type: 'workflow',
          render_engine: 'cloud'
        })
      })
    }
  )

  type Fixture = ReturnType<typeof fixture>
  type CredentialResult = Awaited<ReturnType<Fixture['session']['ensureFresh']>>
  type PendingCredential = ReturnType<
    typeof Promise.withResolvers<CredentialResult>
  >
  type CredentialBoundary = {
    name: string
    next: () => WorkshopSession
    prepare: (
      f: Fixture,
      pending: PendingCredential,
      requested: () => void
    ) => void
    postedTokens: string[]
    expectedIntent: SavedWorkflow | undefined
  }
  const boundaries: CredentialBoundary[] = [
    {
      name: 'an account switch during credential refresh',
      next: () => credential('bob'),
      prepare(f, pending, requested) {
        vi.mocked(f.session.ensureFresh).mockImplementationOnce(async () => {
          requested()
          return pending.promise
        })
      },
      postedTokens: [],
      expectedIntent: undefined
    },
    {
      name: 'a workspace switch during credential refresh',
      next: () => credential('alice', 'workspace-b'),
      prepare(f, pending, requested) {
        vi.mocked(f.session.ensureFresh).mockImplementationOnce(async () => {
          requested()
          return pending.promise
        })
      },
      postedTokens: [],
      expectedIntent: undefined
    },
    {
      name: 'an account switch during 401 token renewal',
      next: () => credential('bob'),
      prepare(f, pending, requested) {
        f.fetch.mockResolvedValueOnce(Response.json({}, { status: 401 }))
        vi.mocked(f.session.remint).mockImplementationOnce(async () => {
          requested()
          return pending.promise
        })
      },
      postedTokens: ['Bearer alice:workspace-a:token'],
      expectedIntent: {
        version: 2,
        stage: 'intent',
        attempt: {
          request: {
            workflowId: 'workflows/remove-background',
            definitionVersion: '1',
            appInputs: { image: 'canonical-image.webp' }
          }
        },
        cancelRequested: false
      }
    }
  ]

  it.for(boundaries)(
    'does not submit a different caller after $name',
    async ({ prepare, postedTokens, expectedIntent, next }) => {
      const f = fixture()
      const pendingCredential = Promise.withResolvers<CredentialResult>()
      const requested = Promise.withResolvers<void>()
      prepare(f, pendingCredential, requested.resolve)
      const pending = f.workflow.start(input)
      onTestFinished(async () => {
        f.unmount()
        pendingCredential.resolve(undefined)
        await pending
      })
      await requested.promise
      const presentationBeforeSwitch = f.workflow.state.value
      f.current.value = next()
      pendingCredential.resolve({ status: 'ok', session: f.current.value })
      await pending
      expect(
        f.fetch.mock.calls
          .filter(([, init]) => init?.method === 'POST')
          .map(([, init]) => new Headers(init?.headers).get('Authorization'))
      ).toEqual(postedTokens)
      expect(f.workflow.signedIn.value).toBe(false)
      expect(f.workflow.state.value).toEqual(presentationBeforeSwitch)
      expect(
        workflowStorage(sessionStorage, f.scope, f.model.workflowId).read()
      ).toEqual(expectedIntent)
      expect(
        workflowStorage(
          sessionStorage,
          callerScope(f.current.value),
          f.model.workflowId
        ).read()
      ).toBeUndefined()
    }
  )

  const changes = [
    { name: 'the account changes', next: () => credential('bob') },
    {
      name: 'the workspace changes',
      next: () => credential('alice', 'workspace-b')
    }
  ]

  it.for(changes)(
    'does not publish a completed job or refresh credits after $name before disposal',
    async ({ next }) => {
      const f = fixture()
      const response = Promise.withResolvers<Response>()
      const requested = Promise.withResolvers<void>()
      f.fetch
        .mockResolvedValueOnce(
          Response.json({ prompt_id: runId, node_errors: {} })
        )
        .mockImplementationOnce(async () => {
          requested.resolve()
          return response.promise
        })
      const pending = f.workflow.start(input)
      onTestFinished(async () => {
        f.unmount()
        response.resolve(Response.json(finished()))
        await pending
      })
      await requested.promise
      const presentationBeforeSwitch = f.workflow.state.value
      f.current.value = next()
      response.resolve(Response.json(finished()))
      await pending
      expect(f.workflow.state.value).toEqual(presentationBeforeSwitch)
      expect(f.workflow.observation.value).toBeUndefined()
      expect(markWorkshopCreditsDirty).not.toHaveBeenCalled()
      expect(captureWorkshopEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({ name: 'run_finished' })
      )
      expect(
        workflowStorage(sessionStorage, f.scope, f.model.workflowId).read()
      ).toMatchObject({ stage: 'run', runId })
      expect(
        workflowStorage(
          sessionStorage,
          callerScope(f.current.value),
          f.model.workflowId
        ).read()
      ).toBeUndefined()
    }
  )

  it('does not publish an old job into a replacement caller page', async () => {
    const f = fixture()
    const response = Promise.withResolvers<Response>()
    const requested = Promise.withResolvers<void>()
    f.fetch
      .mockResolvedValueOnce(
        Response.json({ prompt_id: runId, node_errors: {} })
      )
      .mockImplementationOnce(async () => {
        requested.resolve()
        return response.promise
      })
    const pending = f.workflow.start(input)
    onTestFinished(async () => {
      f.unmount()
      response.resolve(Response.json(finished()))
      await pending
    })
    await requested.promise
    f.current.value = credential('bob')
    f.unmount()
    vi.mocked(f.session.ensureFresh).mockResolvedValue({
      status: 'ok',
      session: f.current.value
    })
    const replacement = mountWorkflow(f.model, callerScope(f.current.value))
    response.resolve(Response.json(finished()))
    await pending
    expect(replacement.workflow.state.value).toEqual({ phase: 'idle' })
    expect(replacement.workflow.observation.value).toBeUndefined()
    expect(markWorkshopCreditsDirty).not.toHaveBeenCalled()
    expect(f.fetch).toHaveBeenCalledTimes(2)
  })

  it('retains an unknown submission through reconnect and remount without sending again', async () => {
    const f = fixture()
    f.fetch.mockRejectedValueOnce(new TypeError('Lost response'))
    await f.workflow.start(input)
    expect(f.workflow.state.value).toMatchObject({
      phase: 'interrupted',
      error: { code: 'submission_unknown' }
    })
    window.dispatchEvent(new Event('online'))
    await f.workflow.resume()
    f.unmount()
    const restored = mountWorkflow(f.model, f.scope)
    await waitFor(() =>
      expect(restored.workflow.state.value).toMatchObject({
        phase: 'interrupted',
        error: { code: 'submission_unknown' }
      })
    )
    expect(f.fetch).toHaveBeenCalledOnce()
  })

  it('resumes a known job on reconnect without resubmission and marks the owner’s credits dirty', async () => {
    const f = fixture()
    f.fetch
      .mockResolvedValueOnce(
        Response.json({ prompt_id: runId, node_errors: {} })
      )
      .mockRejectedValueOnce(new TypeError('Offline'))
    await f.workflow.start(input)
    expect(f.workflow.state.value.phase).toBe('interrupted')
    expect(captureWorkshopEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: 'run_finished' })
    )
    f.fetch.mockResolvedValueOnce(Response.json(finished()))
    window.dispatchEvent(new Event('online'))
    await waitFor(() => expect(markWorkshopCreditsDirty).toHaveBeenCalledOnce())
    expect(f.workflow.state.value.phase).toBe('settled')
    expect(
      vi.mocked(captureWorkshopEvent).mock.calls.map(([event]) => event.name)
    ).toEqual(['run_started', 'run_finished'])
    expect(f.fetch.mock.calls.map(([, init]) => init?.method)).toEqual([
      'POST',
      'GET',
      'GET'
    ])
  })

  it('finishes a dismissed unknown submission as a client failure once', async () => {
    const f = fixture()
    f.fetch.mockRejectedValueOnce(new TypeError('Lost response'))
    await f.workflow.start(input)
    f.workflow.dismiss()
    f.workflow.dismiss()
    expect(f.workflow.state.value.phase).toBe('idle')
    const finished = vi
      .mocked(captureWorkshopEvent)
      .mock.calls.flatMap(([event]) =>
        event.name === 'run_finished' ? [event.properties] : []
      )
    expect(finished).toEqual([
      expect.objectContaining({
        status: 'failed',
        reason: 'network',
        workflow_error_code: 'submission_unknown',
        duration_ms: expect.any(Number)
      })
    ])
    expect(finished[0]).not.toHaveProperty('request_id')
    expect(f.fetch).toHaveBeenCalledOnce()
  })

  it.for(['known job', 'storage failure', 'restored intent'])(
    'does not finish a dismissed %s without an abandoned local attempt',
    async (scenario) => {
      const f = fixture()
      if (scenario === 'known job')
        f.fetch.mockResolvedValueOnce(
          Response.json({ prompt_id: runId, node_errors: {} })
        )
      f.fetch.mockRejectedValueOnce(new TypeError('Lost response'))
      await f.workflow.start(input)
      let workflow = f.workflow
      if (scenario === 'storage failure')
        vi.spyOn(sessionStorage, 'removeItem').mockImplementationOnce(() => {
          throw new Error('Storage unavailable')
        })
      if (scenario === 'restored intent') {
        f.unmount()
        workflow = mountWorkflow(f.model, f.scope).workflow
        await waitFor(() =>
          expect(workflow.state.value.phase).toBe('interrupted')
        )
      }
      workflow.dismiss()
      expect(captureWorkshopEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({ name: 'run_finished' })
      )
    }
  )

  it.for([
    {
      name: 'no newer saved prompt',
      draft: {},
      expected: 'The submitted prompt'
    },
    {
      name: 'a newer saved prompt',
      draft: { prompt: 'A newer draft prompt' },
      expected: 'A newer draft prompt'
    }
  ])('restores the form with $name', async ({ draft, expected }) => {
    const model = authoredWorkflow('workflows/change-material')
    const owner = credential()
    const scope = callerScope(owner)
    const initial = initialWorkshopPageState(model)
    const newer = ref<FormValues>({ ...draft })
    const draftView = render(
      defineComponent({
        setup() {
          useWorkflowFormDraft(
            model.slug,
            scope,
            ref(initial.schema),
            newer,
            ref(false)
          )
          return () => null
        }
      })
    )
    draftView.unmount()
    workflowStorage(sessionStorage, scope, model.workflowId).write({
      version: 2,
      stage: 'run',
      runId,
      workflowId: model.workflowId,
      definitionVersion: model.workflow.definitionVersion,
      cancelRequested: false,
      appInputs: {
        prompt: 'The submitted prompt',
        image1: 'submitted-image.webp'
      }
    })
    const session = useWorkshopSession()
    session.session = computed(() => owner)
    vi.mocked(session.ensureFresh).mockResolvedValue({
      status: 'ok',
      session: owner
    })
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json(finished()))
    vi.stubGlobal('fetch', fetch)
    const restored = mountWorkflow(model, scope)
    await waitFor(() =>
      expect(restored.workflow.state.value.phase).toBe('settled')
    )
    expect(restored.values.value.prompt).toBe(expected)
    expect(restored.workflow.state.value).toMatchObject({
      record: {
        appInputs: {
          prompt: 'The submitted prompt',
          image1: 'submitted-image.webp'
        }
      }
    })
    expect(fetch.mock.calls.map(([, init]) => init?.method)).toEqual(['GET'])
  })
})
