import { render, waitFor } from '@testing-library/vue'
import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'
import { computed, defineComponent, h, ref, shallowRef } from 'vue'

import type { WorkflowWorkshopModelDetail } from '../config/models-catalogue'
import { initialWorkshopPageState } from '../config/workshop-page-state'
import type { FormValues } from '../config/workshop-playground'
import { restoreFormValues } from '../config/workshop-playground'
import type { WorkshopSession } from '../config/workshop-session-state'
import { useWorkshopSession } from '../config/workshop-session-state'
import { workflowDetailsBySlug } from '../config/workshop-workflow-content'
import type { WorkflowRun } from '../config/workshop-workflow-response'
import { workflowStorage } from '../config/workshop-workflow-storage'
import { useWorkflowFormDraft } from './useWorkflowFormDraft'
import { useWorkflowRun } from './useWorkflowRun'

vi.mock(import('../config/workshop-session-state'))
vi.mock(import('../config/workshop-credits'))

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
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(Response.json({ items: [] }))
  vi.stubGlobal('fetch', fetch)
  const scope = callerScope(owner)
  const view = mountWorkflow(model, scope)
  return { ...view, model, owner, current, session, fetch, scope }
}

function finished(model: WorkflowWorkshopModelDetail): WorkflowRun {
  const now = new Date().toISOString()
  const path = `/v1/workshop/workflow-runs/${runId}`
  return {
    run: {
      id: runId,
      workflowId: model.workflowId,
      definitionVersion: model.workflow.definitionVersion,
      state: 'succeeded',
      outputState: 'failed',
      statusUrl: path,
      createdAt: now,
      updatedAt: now
    },
    runtime: { state: 'unknown' },
    outputs: [],
    retryOutputDeliveryUrl: `${path}/outputs/retry`
  }
}

describe('workflow page caller lifecycle', () => {
  type Fixture = ReturnType<typeof fixture>
  type CredentialResult = Awaited<ReturnType<Fixture['session']['ensureFresh']>>
  type PendingCredential = ReturnType<
    typeof Promise.withResolvers<CredentialResult>
  >
  type CredentialBoundary = {
    boundary: string
    prepare: (
      f: Fixture,
      pending: PendingCredential,
      requested: () => void
    ) => void
    postedTokens: string[]
  }
  const boundaries: CredentialBoundary[] = [
    {
      boundary: 'credential refresh',
      prepare(f, pending, requested) {
        vi.mocked(f.session.ensureFresh).mockImplementationOnce(async () => {
          requested()
          return pending.promise
        })
      },
      postedTokens: []
    },
    {
      boundary: '401 token renewal',
      prepare(f, pending, requested) {
        f.fetch.mockResolvedValueOnce(
          Response.json(
            { error: { code: 'not_authenticated', message: 'Expired' } },
            { status: 401 }
          )
        )
        vi.mocked(f.session.remint).mockImplementationOnce(async () => {
          requested()
          return pending.promise
        })
      },
      postedTokens: ['Bearer alice:workspace-a:token']
    }
  ]
  const changes = [
    { change: 'the account changes', next: () => credential('bob') },
    {
      change: 'the workspace changes',
      next: () => credential('alice', 'workspace-b')
    }
  ]

  it.for(
    boundaries.flatMap((boundary) =>
      changes.map((change) => ({ ...boundary, ...change }))
    )
  )(
    'does not submit a different caller after $change during $boundary',
    async ({ prepare, postedTokens, next }) => {
      const f = fixture()
      await waitFor(() => expect(f.workflow.history.value.status).toBe('ready'))
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
      ).toMatchObject({
        stage: 'intent',
        attempt: { request: { appInputs: input } }
      })
      expect(
        workflowStorage(
          sessionStorage,
          callerScope(f.current.value),
          f.model.workflowId
        ).read()
      ).toBeUndefined()
    }
  )

  it('does not publish old history after the caller page is replaced', async () => {
    const f = fixture()
    await waitFor(() => expect(f.workflow.history.value.status).toBe('ready'))
    const response = Promise.withResolvers<Response>()
    const requested = Promise.withResolvers<void>()
    f.fetch.mockImplementationOnce(async () => {
      requested.resolve()
      return response.promise
    })
    const pending = f.workflow.loadHistory()
    onTestFinished(async () => {
      f.unmount()
      response.resolve(Response.json({ items: [] }))
      await pending
    })
    await requested.promise
    f.current.value = credential('bob')
    f.unmount()
    vi.mocked(f.session.ensureFresh).mockResolvedValue({
      status: 'ok',
      session: f.current.value
    })
    f.fetch.mockResolvedValueOnce(Response.json({ items: [] }))
    const replacement = mountWorkflow(f.model, callerScope(f.current.value))
    await waitFor(() =>
      expect(replacement.workflow.history.value.status).toBe('ready')
    )
    response.resolve(Response.json({ items: [finished(f.model).run] }))
    await pending
    expect(replacement.workflow.history.value).toEqual({
      status: 'ready',
      page: { items: [] }
    })
    expect(f.workflow.history.value.page.items).toEqual([])
    expect(replacement.workflow.observation.value).toBeUndefined()
  })

  it.for(changes)(
    'does not publish history when $change before disposal',
    async ({ next }) => {
      const f = fixture()
      await waitFor(() => expect(f.workflow.history.value.status).toBe('ready'))
      const response = Promise.withResolvers<Response>()
      const requested = Promise.withResolvers<void>()
      f.fetch.mockImplementationOnce(async () => {
        requested.resolve()
        return response.promise
      })
      const pending = f.workflow.loadHistory()
      onTestFinished(async () => {
        f.unmount()
        response.resolve(Response.json({ items: [] }))
        await pending
      })
      await requested.promise
      f.current.value = next()
      response.resolve(Response.json({ items: [finished(f.model).run] }))
      await pending
      expect(f.workflow.history.value.page.items).toEqual([])
      expect(f.workflow.signedIn.value).toBe(false)
    }
  )

  it('does not publish a completed run after the caller changes before disposal', async () => {
    const f = fixture()
    await waitFor(() => expect(f.workflow.history.value.status).toBe('ready'))
    const response = Promise.withResolvers<Response>()
    const requested = Promise.withResolvers<void>()
    f.fetch
      .mockResolvedValueOnce(
        Response.json(
          {
            ...finished(f.model).run,
            state: 'submitting',
            outputState: 'pending'
          },
          { status: 202 }
        )
      )
      .mockImplementationOnce(async () => {
        requested.resolve()
        return response.promise
      })
    const pending = f.workflow.start(input)
    onTestFinished(async () => {
      f.unmount()
      response.resolve(Response.json(finished(f.model)))
      await pending
    })
    await requested.promise
    const presentationBeforeSwitch = f.workflow.state.value
    f.current.value = credential('bob')
    response.resolve(Response.json(finished(f.model)))
    await pending
    expect(f.workflow.state.value).toEqual(presentationBeforeSwitch)
    expect(f.workflow.observation.value).toBeUndefined()
    expect(
      workflowStorage(sessionStorage, f.scope, f.model.workflowId).read()
    ).toMatchObject({ stage: 'run', runId })
  })

  it('restores a run’s inputs while a newer saved form draft wins', async () => {
    const model = authoredWorkflow('workflows/change-material')
    const owner = credential()
    const scope = callerScope(owner)
    const initial = initialWorkshopPageState(model)
    const newer = ref<FormValues>({ prompt: 'A newer draft prompt' })
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
      version: 1,
      stage: 'run',
      runId,
      workflowId: model.workflowId,
      definitionVersion: model.workflow.definitionVersion,
      cancelRequested: false,
      appInputs: {
        prompt: 'The submitted prompt',
        image1: 'https://storage.googleapis.com/inputs/submitted'
      }
    })
    const session = useWorkshopSession()
    session.session = computed(() => owner)
    vi.mocked(session.ensureFresh).mockResolvedValue({
      status: 'ok',
      session: owner
    })
    const fetch = vi.fn<typeof globalThis.fetch>(async (url) =>
      new URL(String(url)).pathname.endsWith(runId)
        ? Response.json(finished(model))
        : Response.json({ items: [] })
    )
    vi.stubGlobal('fetch', fetch)
    const restored = mountWorkflow(model, scope)
    await waitFor(() =>
      expect(restored.workflow.state.value.phase).toBe('settled')
    )
    expect(restored.values.value).toMatchObject({
      prompt: 'A newer draft prompt',
      image1: 'https://storage.googleapis.com/inputs/submitted'
    })
    expect(restored.workflow.state.value).toMatchObject({
      record: { appInputs: { prompt: 'The submitted prompt' } }
    })
    expect(fetch.mock.calls.map(([, init]) => init?.method)).not.toContain(
      'POST'
    )
  })
})
