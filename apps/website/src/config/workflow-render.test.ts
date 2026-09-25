import { describe, expect, it, vi } from 'vitest'

import type { WorkflowWorkshopModelDetail } from './models-catalogue'
import { initialWorkshopPageState } from './workshop-page-state'
import { formForWorkflow } from './workshop-workflow-definition'
import type { WorkflowRun } from './workshop-workflow-response'
import { createWorkflowApi } from './workshop-workflow-api'
import { prepareWorkflowRender, renderWorkflow } from './workflow-render'
import type { WorkflowAttempt } from './workflow-render'

const id = 'bafc696e-e5d4-42f1-9a3d-d01f82a0629b'
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
  cloud: {
    workflow: {
      '1': {
        class_type: 'Example',
        inputs: { text: '', seed: 0, enabled: false }
      }
    },
    inputBindings: {
      prompt: {
        encoding: 'scalar',
        targets: [{ nodeId: '1', inputName: 'text' }]
      },
      seed: {
        encoding: 'scalar',
        targets: [{ nodeId: '1', inputName: 'seed' }]
      },
      enabled: {
        encoding: 'scalar',
        targets: [{ nodeId: '1', inputName: 'enabled' }]
      }
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

function observation(status: 'pending' | 'completed') {
  return {
    id,
    status,
    create_time: Date.now(),
    update_time: Date.now(),
    outputs: {}
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

  it('records prepared inputs before submission and never retries an unknown POST outcome', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValue(new TypeError('connection lost'))
    const api = createWorkflowApi({
      fetch,
      token: 'caller',
      definition: workflow
    })
    let saved: WorkflowAttempt | undefined
    await expect(
      renderWorkflow(
        'test',
        {},
        {
          model,
          api,
          token: 'caller',
          onPrepared: (attempt) => {
            expect(fetch).not.toHaveBeenCalled()
            saved = structuredClone(attempt)
          }
        }
      )
    ).rejects.toMatchObject({ code: 'network' })
    expect(saved?.request.appInputs).toEqual({
      prompt: '',
      seed: 0,
      enabled: false
    })
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch.mock.calls[0][1]?.method).toBe('POST')
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({
      prompt: {
        '1': {
          class_type: 'Example',
          inputs: { text: '', seed: 0, enabled: false }
        }
      }
    })
  })

  it('rejects an invalid native graph before recording a submission intent', async () => {
    const definition = structuredClone(workflow)
    definition.cloud.inputBindings.prompt.targets[0].inputName = 'missing'
    const fetch = vi.fn<typeof globalThis.fetch>()
    const onPrepared = vi.fn()

    await expect(
      renderWorkflow(
        'test',
        {},
        {
          model: { ...model, workflow: definition },
          token: 'caller',
          fetch,
          onPrepared
        }
      )
    ).rejects.toMatchObject({ code: 'definition_incompatible' })

    expect(onPrepared).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('resumes a known Cloud job without another submission', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(Response.json(observation('completed')))
    const result = await renderWorkflow(
      'test',
      {},
      { model, token: 'caller', fetch, runId: id }
    )
    expect(result.run.run.id).toBe(id)
    expect(result.run.run.state).toBe('succeeded')
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch.mock.calls[0][1]?.method).toBe('GET')
  })

  it('detaches a disconnected observer without cancelling the Cloud job', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(Response.json(observation('pending')))
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
