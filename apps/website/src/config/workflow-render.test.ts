import { describe, expect, it, vi } from 'vitest'

import type { WorkflowWorkshopModelDetail } from './models-catalogue'
import { initialWorkshopPageState } from './workshop-page-state'
import { formForWorkflow } from './workshop-workflow-definition'
import type { WorkflowRun } from './workshop-workflow-response'
import { createWorkflowApi } from './workshop-workflow-api'
import { prepareWorkflowRender, renderWorkflow } from './workflow-render'
import type { WorkflowAttempt } from './workflow-render'

const id = 'bafc696e-e5d4-42f1-9a3d-d01f82a0629b'
const path = `/v1/workshop/workflow-runs/${id}`
const workflow = {
  id: 'workflows/test',
  definitionVersion: '1',
  inputs: {
    prompt: {
      label: 'Prompt',
      help: '',
      hidden: false,
      advanced: false,
      control: 'text-area'
    },
    seed: {
      label: 'Seed',
      help: '',
      hidden: false,
      advanced: false,
      control: 'number'
    },
    enabled: {
      label: 'Enabled',
      help: '',
      hidden: false,
      advanced: false,
      control: 'toggle'
    }
  },
  inputSchema: {
    type: 'object',
    properties: {
      prompt: { type: 'string', default: '', maxLength: 200 },
      seed: {
        type: 'integer',
        default: 0,
        minimum: 0,
        maximum: Number.MAX_SAFE_INTEGER
      },
      enabled: { type: 'boolean', default: false }
    },
    required: ['seed', 'enabled'],
    additionalProperties: false
  }
} satisfies WorkflowWorkshopModelDetail['workflow']
const model: WorkflowWorkshopModelDetail = {
  name: 'Test',
  slug: 'test',
  href: '/models/test/',
  type: 'CLOUD',
  workflowId: workflow.id,
  workflowCount: 0,
  capabilities: [],
  modality: 'image',
  workflow,
  form: formForWorkflow(workflow),
  fields: [],
  examples: [],
  defaults: {}
}

function observation(state: WorkflowRun['run']['state']): WorkflowRun {
  const now = new Date().toISOString()
  return {
    run: {
      id,
      workflowId: workflow.id,
      definitionVersion: '1',
      state,
      outputState: state === 'succeeded' ? 'failed' : 'pending',
      statusUrl: path,
      createdAt: now,
      updatedAt: now
    },
    outputs: [],
    runtime: { state: 'unknown' },
    retryOutputDeliveryUrl: `${path}/outputs/retry`
  }
}

describe('shared workflow rendering', () => {
  it('uses the same declared defaults for the form and the render request', async () => {
    const initial = initialWorkshopPageState(model)
    const prepared = await prepareWorkflowRender(
      model,
      {},
      new AbortController().signal
    )
    expect(prepared.appInputs).toEqual(initial.values)
    expect(prepared).toEqual({
      workflowId: workflow.id,
      definitionVersion: '1',
      appInputs: { prompt: '', seed: 0, enabled: false }
    })
    const explicit = await prepareWorkflowRender(
      model,
      { enabled: true, seed: Number.MAX_SAFE_INTEGER },
      new AbortController().signal
    )
    expect(explicit.appInputs).toEqual({
      prompt: '',
      enabled: true,
      seed: Number.MAX_SAFE_INTEGER
    })
  })

  it('supports a zero-input declaration without requesting any uploads', async () => {
    const definition = {
      ...workflow,
      inputs: {},
      inputSchema: { ...workflow.inputSchema, properties: {}, required: [] }
    }
    const empty = {
      ...model,
      workflow: definition,
      form: formForWorkflow(definition)
    }
    const upload = vi.fn()
    expect(
      (
        await prepareWorkflowRender(
          empty,
          {},
          new AbortController().signal,
          upload
        )
      ).appInputs
    ).toEqual({})
    expect(upload).not.toHaveBeenCalled()
  })

  it.for([
    { seed: Number.MAX_SAFE_INTEGER + 1 },
    { seed: NaN },
    { graph: 'override' },
    { workspaceId: 'another' },
    { prompt: 'x'.repeat(201) }
  ])(
    'rejects invalid or undeclared values before calling Cloud: %j',
    async (inputs) => {
      const fetch = vi.fn<typeof globalThis.fetch>()
      await expect(
        renderWorkflow(model.slug, inputs, { model, token: 'caller', fetch })
      ).rejects.toMatchObject({ code: 'invalid_input' })
      expect(fetch).not.toHaveBeenCalled()
    }
  )

  it('persists the exact intent before POST and replays it after a lost admission response', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValueOnce(new TypeError('connection lost'))
      .mockResolvedValueOnce(
        Response.json(observation('submitting').run, { status: 202 })
      )
      .mockResolvedValueOnce(Response.json(observation('succeeded')))
    const api = createWorkflowApi({ fetch, token: 'caller' })
    let saved: WorkflowAttempt | undefined
    const options = {
      model,
      api,
      token: 'caller',
      onPrepared: (attempt: WorkflowAttempt) => {
        expect(fetch).not.toHaveBeenCalled()
        saved = structuredClone(attempt)
      }
    }
    await expect(renderWorkflow('test', {}, options)).rejects.toMatchObject({
      code: 'network'
    })
    expect(saved?.request.appInputs).toEqual({
      prompt: '',
      seed: 0,
      enabled: false
    })
    const result = await renderWorkflow(
      'test',
      { prompt: 'later edit' },
      { model, token: 'renewed', api, attempt: saved }
    )
    expect(result.run.run.state).toBe('succeeded')
    expect(fetch.mock.calls[1][1]?.body).toBe(fetch.mock.calls[0][1]?.body)
    expect(
      new Headers(fetch.mock.calls[1][1]?.headers).get('Idempotency-Key')
    ).toBe(saved?.idempotencyKey)
    expect(
      fetch.mock.calls.filter(([, init]) => init?.method === 'POST')
    ).toHaveLength(2)
  })

  it('resumes an admitted version after the page catalog changes, without another POST', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(Response.json(observation('succeeded')))
    const changed = {
      ...model,
      workflow: { ...workflow, definitionVersion: '2' }
    }
    const result = await renderWorkflow(
      'test',
      {},
      { model: changed, token: 'caller', fetch, runId: id }
    )
    expect(result.run.run.definitionVersion).toBe('1')
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch.mock.calls[0][1]?.method).toBe('GET')
  })

  it('waits for confirmed cancellation and detaches a disconnected observer without cancelling the job', async () => {
    const queued = observation('queued')
    queued.run.cancelRequestedAt = new Date().toISOString()
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(Response.json(queued))
    const controller = new AbortController()
    const observed = Promise.withResolvers<WorkflowRun>()
    const pending = renderWorkflow(
      'test',
      {},
      {
        model,
        token: 'caller',
        fetch,
        runId: id,
        signal: controller.signal,
        onUpdate: observed.resolve
      }
    )
    const failure = pending.catch((error: unknown) => error)
    expect((await observed.promise).run.state).toBe('queued')
    controller.abort()
    expect(await failure).toMatchObject({ name: 'AbortError' })
    expect(fetch.mock.calls.map(([, init]) => init?.method)).toEqual(['GET'])
  })
})
