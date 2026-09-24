import type { JobDetailResponse } from '@comfyorg/ingest-types'
import { describe, expect, it, onTestFinished, vi } from 'vitest'

import {
  createWorkflowApi,
  WorkshopWorkflowError
} from './workshop-workflow-api'
import type { WorkflowApiOptions } from './workshop-workflow-api'
import { workflowDetailsBySlug } from './workshop-workflow-content'
import { createWorkflowController } from './workshop-workflow-controller'
import type { WorkflowErrorCode } from './workshop-workflow-response'
import { WORKFLOW_CONTROL_BYTES } from './workshop-workflow-response'
import type { WorkflowState } from './workshop-workflow-state'
import { workflowStorage } from './workshop-workflow-storage'
import type { WorkflowMediaUploader } from './workshop-workflow-upload'

const id = 'bafc696e-e5d4-42f1-9a3d-d01f82a0629b'
const otherId = '2f290fb5-0a9f-42e3-a392-55bd8c016758'
const input = { image: 'https://storage.googleapis.com/inputs/canonical-image' }
const uploaded = { image: 'canonical-image.webp' }

function authoredWorkflow(slug: string) {
  const model = workflowDetailsBySlug.get(slug)
  if (!model) throw new Error('Missing authored test workflow')
  return model
}

function job(
  status: JobDetailResponse['status'] = 'completed',
  runId = id
): JobDetailResponse {
  return {
    id: runId,
    status,
    create_time: Date.now(),
    update_time: Date.now(),
    outputs: {
      '18': {
        images: [{ filename: 'result.png', short_url: '/api/s/current-result' }]
      }
    }
  }
}

function fixture({
  workflowSlug = 'workflows/remove-background',
  scope = 'user:workspace',
  token = scope,
  backing = sessionStorage
}: {
  workflowSlug?: string
  scope?: string
  token?: WorkflowApiOptions['token']
  backing?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
} = {}) {
  const model = authoredWorkflow(workflowSlug)
  const storage = workflowStorage(backing, scope, model.workflowId)
  const fetch = vi.fn<typeof globalThis.fetch>()
  const uploadFile = vi
    .fn<WorkflowMediaUploader>()
    .mockResolvedValue('canonical-image.webp')
  const updates: WorkflowState[] = []
  const api = createWorkflowApi({ token, fetch, definition: model.workflow })
  const controller = createWorkflowController({
    model,
    api,
    storage,
    uploadFile,
    onChange: (state) => updates.push(state)
  })
  onTestFinished(() => controller.dispose())
  return { model, controller, storage, fetch, uploadFile, updates }
}

describe('existing Cloud workflow controller', () => {
  it('rejects an oversized native graph without saving a submission intent', async () => {
    const f = fixture({ workflowSlug: 'workflows/change-material' })

    await f.controller.start({
      image1: input.image,
      image2: input.image,
      prompt: 'x'.repeat(WORKFLOW_CONTROL_BYTES - 2000)
    })

    expect(f.updates.at(-1)?.phase).toBe('failed')
    expect(f.updates.at(-1)).toMatchObject({
      error: new WorkshopWorkflowError('payload_too_large')
    })
    expect(f.storage.read()).toBeUndefined()
    expect(f.fetch).not.toHaveBeenCalled()
  })

  it.for([
    { name: 'missing credentials', token: '', code: 'not_authenticated' },
    {
      name: 'failed credential resolution',
      token: async () => {
        throw new TypeError('Session unavailable')
      },
      code: 'network'
    }
  ] as const)(
    'rejects $name without saving a submission intent',
    async ({ token, code }) => {
      const f = fixture({ token })

      await f.controller.start(input)

      expect(f.updates.at(-1)).toEqual({
        phase: 'failed',
        error: new WorkshopWorkflowError(code)
      })
      expect(f.storage.read()).toBeUndefined()
      expect(f.fetch).not.toHaveBeenCalled()
    }
  )

  it('refuses to submit when it cannot save the recovery intent', async () => {
    const f = fixture({
      backing: {
        getItem: () => null,
        setItem() {
          throw new DOMException('Storage is full', 'QuotaExceededError')
        },
        removeItem() {}
      }
    })
    await f.controller.start(input)
    expect(f.fetch).not.toHaveBeenCalled()
    expect(f.updates.at(-1)).toEqual({
      phase: 'failed',
      error: new WorkshopWorkflowError('persistence')
    })
  })

  it('recovers a known job after reload with the current token and stored inputs', async () => {
    const f = fixture()
    f.fetch
      .mockResolvedValueOnce(Response.json({ prompt_id: id, node_errors: {} }))
      .mockRejectedValueOnce(new TypeError('Disconnected'))
    await f.controller.start(input)
    expect(f.updates.at(-1)?.phase).toBe('interrupted')
    expect(f.storage.read()).toMatchObject({
      version: 2,
      stage: 'run',
      runId: id,
      appInputs: uploaded
    })
    expect(JSON.stringify(f.storage.read())).not.toContain('Bearer')
    f.controller.dispose()
    const restored = fixture({ token: 'renewed-session' })
    restored.fetch.mockResolvedValueOnce(Response.json(job()))
    await restored.controller.resume()
    expect(restored.updates.at(-1)).toMatchObject({
      phase: 'settled',
      observation: { run: { id, state: 'succeeded' } }
    })
    expect(restored.uploadFile).not.toHaveBeenCalled()
    expect(
      restored.fetch.mock.calls.map(([url, init]) => ({
        path: new URL(String(url)).pathname,
        method: init?.method,
        authorization: new Headers(init?.headers).get('Authorization')
      }))
    ).toEqual([
      {
        path: `/api/jobs/${id}`,
        method: 'GET',
        authorization: 'Bearer renewed-session'
      }
    ])
  })

  it('retains a known job in memory when persisting its admission fails', async () => {
    const f = fixture({
      backing: {
        getItem: (key) => sessionStorage.getItem(key),
        setItem: vi
          .fn<Storage['setItem']>()
          .mockImplementationOnce((key, value) =>
            sessionStorage.setItem(key, value)
          )
          .mockImplementationOnce(() => {
            throw new DOMException('Storage is full', 'QuotaExceededError')
          }),
        removeItem: (key) => sessionStorage.removeItem(key)
      }
    })
    f.fetch.mockResolvedValueOnce(
      Response.json({ prompt_id: id, node_errors: {} })
    )
    await f.controller.start(input)
    expect(f.updates.at(-1)).toMatchObject({
      phase: 'interrupted',
      record: { stage: 'run', runId: id },
      error: new WorkshopWorkflowError('persistence')
    })
    f.fetch.mockResolvedValueOnce(Response.json(job()))
    await f.controller.resume()
    expect(f.updates.at(-1)).toMatchObject({ phase: 'settled' })
    expect(f.fetch.mock.calls.map(([, init]) => init?.method)).toEqual([
      'POST',
      'GET'
    ])
  })

  it('preserves cancellation intent after an unknown submission without replaying on reload', async () => {
    const f = fixture()
    const dispatched = Promise.withResolvers<void>()
    const response = Promise.withResolvers<Response>()
    f.fetch.mockImplementationOnce(async () => {
      dispatched.resolve()
      return response.promise
    })
    const pending = f.controller.start(input)
    onTestFinished(async () => {
      f.controller.dispose()
      response.reject(new TypeError('Disconnected'))
      await pending
    })
    await dispatched.promise
    await f.controller.cancel()
    expect(f.storage.read()).toMatchObject({
      stage: 'intent',
      cancelRequested: true
    })
    response.reject(new TypeError('Lost response'))
    await pending
    f.controller.dispose()
    const restored = fixture()
    await restored.controller.resume()
    await restored.controller.cancel()
    expect(restored.fetch).not.toHaveBeenCalled()
    expect(restored.uploadFile).not.toHaveBeenCalled()
    expect(restored.updates.at(-1)).toMatchObject({
      phase: 'interrupted',
      error: new WorkshopWorkflowError('submission_unknown'),
      record: { stage: 'intent', cancelRequested: true }
    })
  })

  it('isolates saved jobs and ignores late results after account or workspace switching', async () => {
    const a = fixture({ scope: 'alice:workspace-a' })
    const read = Promise.withResolvers<Response>()
    const observing = Promise.withResolvers<void>()
    a.fetch
      .mockResolvedValueOnce(Response.json({ prompt_id: id, node_errors: {} }))
      .mockImplementationOnce(async () => {
        observing.resolve()
        return read.promise
      })
    const pending = a.controller.start(input)
    onTestFinished(async () => {
      a.controller.dispose()
      read.resolve(Response.json(job()))
      await pending
    })
    await observing.promise
    a.controller.dispose()
    const b = fixture({ scope: 'bob:workspace-a' })
    await b.controller.resume()
    const anotherWorkspace = fixture({ scope: 'alice:workspace-b' })
    await anotherWorkspace.controller.resume()
    expect(b.fetch).not.toHaveBeenCalled()
    expect(anotherWorkspace.fetch).not.toHaveBeenCalled()
    read.resolve(Response.json(job()))
    await pending
    expect(a.updates.at(-1)).toEqual({ phase: 'idle' })
    expect(a.updates.some((state) => state.phase === 'settled')).toBe(false)
    expect(a.storage.read()).toMatchObject({ stage: 'run', runId: id })
  })

  it('keeps cancellation active until native job polling confirms a terminal state', async () => {
    const f = fixture()
    f.fetch
      .mockResolvedValueOnce(Response.json({ prompt_id: id, node_errors: {} }))
      .mockRejectedValueOnce(new TypeError('Disconnected'))
    await f.controller.start(input)
    const reading = Promise.withResolvers<void>()
    const terminal = Promise.withResolvers<Response>()
    f.fetch
      .mockResolvedValueOnce(Response.json({ cancelled: true }))
      .mockResolvedValueOnce(Response.json(job('in_progress')))
      .mockImplementationOnce(async () => {
        reading.resolve()
        return terminal.promise
      })
    const cancelling = f.controller.cancel()
    onTestFinished(async () => {
      f.controller.dispose()
      terminal.resolve(Response.json(job('cancelled')))
      await cancelling
    })
    await reading.promise
    expect(f.updates.at(-1)).toMatchObject({
      phase: 'active',
      record: { runId: id, cancelRequested: true },
      observation: { run: { state: 'running' } }
    })
    expect(f.updates.some((state) => state.phase === 'settled')).toBe(false)
    expect(f.storage.read()).toMatchObject({
      stage: 'run',
      runId: id,
      cancelRequested: true
    })
    terminal.resolve(Response.json(job('cancelled')))
    await cancelling
    expect(f.updates.at(-1)).toMatchObject({
      phase: 'settled',
      observation: { run: { state: 'cancelled' } }
    })
    expect(
      f.fetch.mock.calls
        .filter(([, init]) => init?.method === 'POST')
        .map(([url]) => new URL(String(url)).pathname)
    ).toEqual(['/api/prompt', `/api/jobs/${id}/cancel`])
  })

  const confirmedRejections: ReadonlyArray<{
    code: WorkflowErrorCode
    status: number
  }> = [
    { code: 'invalid_input', status: 422 },
    { code: 'insufficient_credits', status: 402 },
    { code: 'rate_limited', status: 429 }
  ]

  it.for(confirmedRejections)(
    'allows a corrected form after confirmed $code rejection',
    async ({ code, status }) => {
      const f = fixture()
      f.fetch.mockResolvedValueOnce(Response.json({ error: {} }, { status }))
      await f.controller.start(input)
      expect(f.storage.read()).toBeUndefined()
      expect(f.updates.at(-1)).toEqual({
        phase: 'failed',
        error: new WorkshopWorkflowError(code, {}, status)
      })
      f.uploadFile.mockResolvedValueOnce('corrected-image.webp')
      f.fetch
        .mockResolvedValueOnce(
          Response.json({ prompt_id: id, node_errors: {} })
        )
        .mockResolvedValueOnce(Response.json(job()))
      await f.controller.start({
        image: 'https://storage.googleapis.com/inputs/corrected'
      })
      expect(f.storage.read()).toMatchObject({
        stage: 'run',
        runId: id,
        appInputs: { image: 'corrected-image.webp' }
      })
      expect(f.updates.at(-1)).toMatchObject({
        phase: 'settled',
        observation: { run: { id } }
      })
      expect(f.fetch.mock.calls.map(([, init]) => init?.method)).toEqual([
        'POST',
        'POST',
        'GET'
      ])
    }
  )

  it.for([
    {
      name: 'a lost response',
      response: () => Promise.reject(new TypeError('Disconnected'))
    },
    {
      name: 'an invalid success response',
      response: async () => Response.json({ job: id })
    },
    {
      name: 'an upstream service failure',
      response: async () => Response.json({ error: {} }, { status: 503 })
    },
    {
      name: 'a rejection-shaped server error',
      response: async () =>
        Response.json({ error: { type: 'invalid_input' } }, { status: 500 })
    }
  ])(
    'does not replay an unknown submission after $name, resume, or reload',
    async ({ response }) => {
      const f = fixture()
      f.fetch.mockImplementationOnce(response)
      await f.controller.start(input)
      const saved = f.storage.read()
      await f.controller.start({
        image: 'https://storage.googleapis.com/inputs/different'
      })
      await f.controller.resume()
      expect(f.fetch).toHaveBeenCalledOnce()
      expect(f.storage.read()).toEqual(saved)
      expect(f.updates.at(-1)).toMatchObject({
        phase: 'interrupted',
        error: new WorkshopWorkflowError('submission_unknown'),
        record: {
          stage: 'intent',
          attempt: { request: { appInputs: uploaded } }
        }
      })
      f.controller.dispose()
      const restored = fixture()
      await restored.controller.resume()
      expect(restored.fetch).not.toHaveBeenCalled()
      expect(restored.uploadFile).not.toHaveBeenCalled()
      expect(restored.updates.at(-1)).toMatchObject({
        phase: 'interrupted',
        error: new WorkshopWorkflowError('submission_unknown')
      })
    }
  )

  it('requires dismissal after the uncertain request settles before a fresh submission', async () => {
    const f = fixture()
    const dispatched = Promise.withResolvers<void>()
    const response = Promise.withResolvers<Response>()
    f.fetch.mockImplementationOnce(async () => {
      dispatched.resolve()
      return response.promise
    })
    const pending = f.controller.start(input)
    onTestFinished(async () => {
      f.controller.dispose()
      response.reject(new TypeError('Disconnected'))
      await pending
    })
    await dispatched.promise
    await f.controller.resume()
    f.controller.dismiss()
    expect(f.storage.read()).toMatchObject({ stage: 'intent' })
    await f.controller.start(input)
    expect(f.fetch).toHaveBeenCalledOnce()
    response.reject(new TypeError('Lost response'))
    await pending
    f.controller.dismiss()
    expect(f.storage.read()).toBeUndefined()
    expect(f.updates.at(-1)).toEqual({ phase: 'idle' })
    f.fetch
      .mockResolvedValueOnce(
        Response.json({ prompt_id: otherId, node_errors: {} })
      )
      .mockResolvedValueOnce(Response.json(job('completed', otherId)))
    await f.controller.start(input)
    expect(f.updates.at(-1)).toMatchObject({
      phase: 'settled',
      record: { runId: otherId }
    })
    expect(f.fetch.mock.calls.map(([, init]) => init?.method)).toEqual([
      'POST',
      'POST',
      'GET'
    ])
  })

  it('retains the uncertain intent when dismissal cannot clear storage', async () => {
    const f = fixture({
      backing: {
        getItem: (key) => sessionStorage.getItem(key),
        setItem: (key, value) => sessionStorage.setItem(key, value),
        removeItem() {
          throw new DOMException('Storage is unavailable', 'SecurityError')
        }
      }
    })
    f.fetch.mockRejectedValueOnce(new TypeError('Lost response'))
    await f.controller.start(input)
    f.controller.dismiss()
    await f.controller.start(input)
    expect(f.fetch).toHaveBeenCalledOnce()
    expect(f.updates.at(-1)).toMatchObject({ phase: 'interrupted' })
    expect(f.storage.read()).toMatchObject({
      stage: 'intent',
      attempt: { request: { appInputs: uploaded } }
    })
  })

  it('does not replace or dismiss a job while its result is being observed', async () => {
    const f = fixture()
    const reading = Promise.withResolvers<void>()
    const result = Promise.withResolvers<Response>()
    f.fetch
      .mockResolvedValueOnce(Response.json({ prompt_id: id, node_errors: {} }))
      .mockImplementationOnce(async () => {
        reading.resolve()
        return result.promise
      })
    const active = f.controller.start(input)
    onTestFinished(async () => {
      f.controller.dispose()
      result.resolve(Response.json(job()))
      await active
    })
    await reading.promise
    const saved = f.storage.read()
    f.controller.dismiss()
    await f.controller.start(input)
    expect(f.storage.read()).toEqual(saved)
    result.resolve(Response.json(job()))
    await active
    expect(f.fetch).toHaveBeenCalledTimes(2)
    expect(f.updates.at(-1)).toMatchObject({
      phase: 'settled',
      observation: { run: { id, state: 'succeeded' } }
    })
  })

  it.for(['completed', 'failed', 'cancelled'] as const)(
    'clears a %s run when returning to an example',
    async (status) => {
      const f = fixture()
      f.fetch
        .mockResolvedValueOnce(Response.json({ prompt_id: id }))
        .mockResolvedValueOnce(Response.json(job(status)))
      await f.controller.start(input)
      f.controller.dismiss()
      expect(f.storage.read()).toBeUndefined()
      expect(f.updates.at(-1)).toEqual({ phase: 'idle' })
      expect(f.fetch).toHaveBeenCalledTimes(2)
    }
  )

  it('does not restore a dismissed result when output delivery finishes late', async () => {
    const f = fixture()
    f.fetch
      .mockResolvedValueOnce(Response.json({ prompt_id: id }))
      .mockResolvedValueOnce(Response.json(job()))
    await f.controller.start(input)
    const requesting = Promise.withResolvers<void>()
    const response = Promise.withResolvers<Response>()
    f.fetch.mockImplementationOnce(async () => {
      requesting.resolve()
      return response.promise
    })
    const pending = f.controller.refreshOutput('image:0')
    onTestFinished(async () => {
      response.resolve(Response.json(job()))
      await pending
    })
    await requesting.promise
    f.controller.dismiss()
    response.resolve(Response.json(job()))
    await pending
    expect(f.updates.at(-1)).toEqual({ phase: 'idle' })
    expect(f.storage.read()).toBeUndefined()
  })

  type Fixture = ReturnType<typeof fixture>
  type DeferredResponse = ReturnType<typeof Promise.withResolvers<Response>>

  it.for([
    {
      name: 'an output refresh',
      run: (f: Fixture) => f.controller.refreshOutput('image:0')
    },
    {
      name: 'a delivery retry',
      run: (f: Fixture) => f.controller.retryDelivery()
    }
  ])('keeps a completed run settled when $name fails', async ({ run }) => {
    const f = fixture()
    f.fetch
      .mockResolvedValueOnce(Response.json({ prompt_id: id }))
      .mockResolvedValueOnce(Response.json(job()))
    await f.controller.start(input)
    const settled = f.updates.at(-1)
    const saved = f.storage.read()
    expect(settled).toMatchObject({ phase: 'settled' })
    f.fetch.mockRejectedValueOnce(new TypeError('Delivery unavailable'))

    await run(f)

    expect(f.updates.at(-1)).toEqual(settled)
    expect(f.storage.read()).toEqual(saved)
    expect(f.fetch.mock.calls.map(([, init]) => init?.method)).toEqual([
      'POST',
      'GET',
      'GET'
    ])
  })

  const deliveryActions = [
    {
      name: 'a successful output refresh',
      run: (f: Fixture) => f.controller.refreshOutput('image:0'),
      complete: (response: DeferredResponse) =>
        response.resolve(Response.json(job()))
    },
    {
      name: 'a failed output refresh',
      run: (f: Fixture) => f.controller.refreshOutput('image:0'),
      complete: (response: DeferredResponse) =>
        response.reject(new TypeError('Delivery unavailable'))
    },
    {
      name: 'a successful delivery retry',
      run: (f: Fixture) => f.controller.retryDelivery(),
      complete: (response: DeferredResponse) =>
        response.resolve(Response.json(job()))
    },
    {
      name: 'a failed delivery retry',
      run: (f: Fixture) => f.controller.retryDelivery(),
      complete: (response: DeferredResponse) =>
        response.reject(new TypeError('Delivery unavailable'))
    }
  ]

  it.for(deliveryActions)(
    'ignores $name after disposal',
    async ({ run, complete }) => {
      const f = fixture()
      f.fetch
        .mockResolvedValueOnce(
          Response.json({ prompt_id: id, node_errors: {} })
        )
        .mockResolvedValueOnce(Response.json(job()))
      await f.controller.start(input)
      const requesting = Promise.withResolvers<void>()
      const response = Promise.withResolvers<Response>()
      f.fetch.mockImplementationOnce(async () => {
        requesting.resolve()
        return response.promise
      })
      const pending = run(f)
      onTestFinished(async () => {
        f.controller.dispose()
        response.resolve(Response.json(job()))
        await pending
      })
      await requesting.promise
      f.controller.dispose()
      const saved = f.storage.read()
      complete(response)
      await pending
      expect(f.updates.at(-1)).toEqual({ phase: 'idle' })
      expect(f.storage.read()).toEqual(saved)
      expect(f.fetch).toHaveBeenCalledTimes(3)
    }
  )
})
