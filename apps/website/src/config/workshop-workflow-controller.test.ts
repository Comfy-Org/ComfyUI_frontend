import { describe, expect, it, onTestFinished, vi } from 'vitest'

import {
  createWorkflowApi,
  WorkshopWorkflowError
} from './workshop-workflow-api'
import { workflowDetailsBySlug } from './workshop-workflow-content'
import { createWorkflowController } from './workshop-workflow-controller'
import type {
  WorkflowAccess,
  WorkflowErrorCode,
  WorkflowRun
} from './workshop-workflow-response'
import { workflowStorage } from './workshop-workflow-storage'
import type { WorkflowState } from './workshop-workflow-state'

const id = 'bafc696e-e5d4-42f1-9a3d-d01f82a0629b'
const otherId = '2f290fb5-0a9f-42e3-a392-55bd8c016758'
const outputId = 'caa84bc4-cd81-50fd-8c0e-ebac0d902a53'
const input = { image: 'https://storage.googleapis.com/inputs/canonical-image' }

function authoredWorkflow() {
  const model = workflowDetailsBySlug.get('workflows/remove-background')
  if (!model) throw new Error('Missing authored test workflow')
  return model
}

function fixture(scope = 'user:workspace') {
  const model = authoredWorkflow()
  const storage = workflowStorage(sessionStorage, scope, model.workflowId)
  const fetch = vi.fn<typeof globalThis.fetch>()
  const updates: WorkflowState[] = []
  const api = createWorkflowApi({ token: scope, fetch })
  const controller = createWorkflowController({
    model,
    api,
    storage,
    onChange: (state) => updates.push(state)
  })
  onTestFinished(() => controller.dispose())
  function observation(
    state: WorkflowRun['run']['state'],
    runId = id
  ): WorkflowRun {
    const now = new Date().toISOString()
    const path = `/v1/workshop/workflow-runs/${runId}`
    return {
      run: {
        id: runId,
        workflowId: model.workflowId,
        definitionVersion: model.workflow.definitionVersion,
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
  function access(): WorkflowAccess {
    return {
      url: 'https://storage.googleapis.com/results/refreshed.png?signature=fresh',
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      refreshUrl: `/v1/workshop/workflow-runs/${id}/outputs/${outputId}/access`,
      mimeType: 'image/png',
      sizeBytes: 16
    }
  }
  function delivered(): WorkflowRun {
    const result = observation('succeeded')
    return {
      ...result,
      run: { ...result.run, outputState: 'ready' },
      outputs: [
        {
          id: outputId,
          bindingId: 'result',
          fileIndex: 0,
          kind: 'image',
          accessUrl: access().refreshUrl,
          delivery: { state: 'ready', access: access() }
        }
      ]
    }
  }
  return {
    model,
    controller,
    storage,
    fetch,
    api,
    updates,
    observation,
    access,
    delivered
  }
}

describe('durable browser workflow controller', () => {
  it('refuses to dispatch when it cannot save the recovery intent', async () => {
    const f = fixture()
    const storage = workflowStorage(
      {
        getItem: () => null,
        setItem() {
          throw new DOMException('Storage is full', 'QuotaExceededError')
        },
        removeItem() {}
      },
      'user:workspace',
      f.model.workflowId
    )
    const controller = createWorkflowController({
      model: f.model,
      api: f.api,
      storage,
      onChange: (state) => f.updates.push(state)
    })
    onTestFinished(() => controller.dispose())
    await controller.start(input)
    expect(f.fetch).not.toHaveBeenCalled()
    expect(f.updates.at(-1)).toEqual({
      phase: 'failed',
      error: new WorkshopWorkflowError('persistence')
    })
  })

  it('recovers an admitted run after refresh with a new token and preserves its input references', async () => {
    const f = fixture()
    f.fetch
      .mockResolvedValueOnce(
        Response.json(f.observation('submitting').run, { status: 202 })
      )
      .mockRejectedValueOnce(new TypeError('Disconnected'))
    await f.controller.start(input)
    expect(f.updates.at(-1)?.phase).toBe('interrupted')
    expect(f.storage.read()).toMatchObject({
      stage: 'run',
      runId: id,
      appInputs: input
    })
    expect(JSON.stringify(f.storage.read())).not.toContain('Bearer')
    f.controller.dispose()
    const restored = fixture()
    restored.fetch.mockResolvedValueOnce(
      Response.json(restored.observation('succeeded'))
    )
    await restored.controller.resume()
    expect(restored.updates.at(-1)).toMatchObject({
      phase: 'settled',
      observation: { run: { id, state: 'succeeded' } }
    })
    expect(restored.fetch).toHaveBeenCalledOnce()
    expect(restored.fetch.mock.calls[0][1]?.method).toBe('GET')
  })

  it('keeps a cancellation request through a lost submission response and a reload', async () => {
    const f = fixture()
    const dispatched = Promise.withResolvers<void>()
    const unknown = Promise.withResolvers<Response>()
    f.fetch.mockImplementationOnce(async () => {
      dispatched.resolve()
      return unknown.promise
    })
    const pending = f.controller.start(input)
    await dispatched.promise
    await f.controller.cancel()
    expect(f.storage.read()).toMatchObject({
      stage: 'intent',
      cancelRequested: true
    })
    unknown.reject(new TypeError('Lost response'))
    await pending
    const originalBody = f.fetch.mock.calls[0][1]?.body
    const originalKey = new Headers(f.fetch.mock.calls[0][1]?.headers).get(
      'Idempotency-Key'
    )
    f.controller.dispose()
    const restored = fixture()
    const queued = restored.observation('queued')
    queued.run.cancelRequestedAt = new Date().toISOString()
    restored.fetch
      .mockResolvedValueOnce(Response.json(queued.run, { status: 202 }))
      .mockResolvedValueOnce(Response.json(queued, { status: 202 }))
      .mockResolvedValueOnce(Response.json(restored.observation('cancelled')))
    await restored.controller.resume()
    expect(restored.fetch.mock.calls[0][1]?.body).toBe(originalBody)
    expect(
      new Headers(restored.fetch.mock.calls[0][1]?.headers).get(
        'Idempotency-Key'
      )
    ).toBe(originalKey)
    expect(String(restored.fetch.mock.calls[1][0])).toContain(`/${id}/cancel`)
    expect(
      restored.updates.some(
        (state) =>
          'observation' in state && state.observation?.run.state === 'queued'
      )
    ).toBe(true)
    expect(restored.updates.at(-1)).toMatchObject({
      phase: 'settled',
      observation: { run: { state: 'cancelled' } }
    })
  })

  it('isolates saved runs and rejects late results after account or workspace switching', async () => {
    const a = fixture('alice:workspace-a')
    const read = Promise.withResolvers<Response>()
    const observing = Promise.withResolvers<void>()
    a.fetch
      .mockResolvedValueOnce(
        Response.json(a.observation('submitting').run, { status: 202 })
      )
      .mockImplementationOnce(async () => {
        observing.resolve()
        return read.promise
      })
    const pending = a.controller.start(input)
    await observing.promise
    a.controller.dispose()
    const b = fixture('bob:workspace-a')
    await b.controller.resume()
    expect(b.fetch).not.toHaveBeenCalled()
    const anotherWorkspace = fixture('alice:workspace-b')
    await anotherWorkspace.controller.resume()
    expect(anotherWorkspace.fetch).not.toHaveBeenCalled()
    read.resolve(Response.json(a.observation('succeeded')))
    await pending
    expect(a.updates.at(-1)).toEqual({ phase: 'idle' })
    expect(a.updates.some((state) => state.phase === 'settled')).toBe(false)
    expect(a.storage.read()).toMatchObject({ stage: 'run', runId: id })
  })

  it('keeps an acknowledged cancellation active until Cloud confirms a terminal state', async () => {
    const f = fixture()
    f.fetch
      .mockResolvedValueOnce(
        Response.json(f.observation('submitting').run, { status: 202 })
      )
      .mockRejectedValueOnce(new TypeError('Disconnected'))
    await f.controller.start(input)
    const requested = f.observation('running')
    requested.run.cancelRequestedAt = new Date().toISOString()
    const reading = Promise.withResolvers<void>()
    const terminal = Promise.withResolvers<Response>()
    f.fetch
      .mockResolvedValueOnce(Response.json(requested, { status: 202 }))
      .mockImplementationOnce(async () => {
        reading.resolve()
        return terminal.promise
      })
    const cancelling = f.controller.cancel()
    onTestFinished(async () => {
      f.controller.dispose()
      terminal.resolve(Response.json(f.observation('cancelled')))
      await cancelling
    })
    await reading.promise
    expect(f.updates.at(-1)).toMatchObject({
      phase: 'active',
      record: { runId: id, cancelRequested: true },
      observation: {
        run: {
          state: 'running',
          cancelRequestedAt: requested.run.cancelRequestedAt
        }
      }
    })
    expect(f.updates.some((state) => state.phase === 'settled')).toBe(false)
    expect(f.storage.read()).toMatchObject({
      stage: 'run',
      runId: id,
      cancelRequested: true
    })
    terminal.resolve(Response.json(f.observation('cancelled')))
    await cancelling
    expect(f.updates.at(-1)).toMatchObject({
      phase: 'settled',
      observation: { run: { state: 'cancelled' } }
    })
  })

  it('opens an owned history entry without fabricating inputs or submitting inference', async () => {
    const f = fixture()
    const result = f.observation('succeeded')
    f.fetch.mockResolvedValueOnce(Response.json(result))
    await f.controller.open(result.run)
    expect(f.fetch).toHaveBeenCalledOnce()
    expect(f.fetch.mock.calls[0][1]?.method).toBe('GET')
    expect(f.storage.read()).toEqual({
      version: 1,
      stage: 'run',
      runId: id,
      workflowId: f.model.workflowId,
      definitionVersion: f.model.workflow.definitionVersion,
      cancelRequested: false
    })
  })

  const confirmedRejections: ReadonlyArray<{
    code: WorkflowErrorCode
    status: number
  }> = [
    { code: 'invalid_input', status: 422 },
    { code: 'definition_changed', status: 409 },
    { code: 'admission_disabled', status: 503 }
  ]

  it.for(confirmedRejections)(
    'allows a corrected form after confirmed $code rejection',
    async ({ code, status }) => {
      const f = fixture()
      f.fetch.mockResolvedValueOnce(
        Response.json({ error: { code, message: 'Rejected' } }, { status })
      )
      await f.controller.start(input)
      expect(f.storage.read()).toBeUndefined()
      expect(f.updates.at(-1)).toEqual({
        phase: 'failed',
        error: new WorkshopWorkflowError(code, {}, status)
      })
      const originalKey = new Headers(f.fetch.mock.calls[0][1]?.headers).get(
        'Idempotency-Key'
      )
      const corrected = {
        image: 'https://storage.googleapis.com/inputs/corrected'
      }
      f.fetch
        .mockResolvedValueOnce(
          Response.json(f.observation('submitting').run, { status: 202 })
        )
        .mockResolvedValueOnce(Response.json(f.observation('succeeded')))
      await f.controller.start(corrected)
      expect(f.fetch.mock.calls[1][1]?.body).toBe(
        JSON.stringify({
          workflowId: f.model.workflowId,
          definitionVersion: f.model.workflow.definitionVersion,
          appInputs: corrected
        })
      )
      expect(
        new Headers(f.fetch.mock.calls[1][1]?.headers).get('Idempotency-Key')
      ).not.toBe(originalKey)
      expect(f.storage.read()).toMatchObject({
        stage: 'run',
        runId: id,
        appInputs: corrected
      })
      expect(f.updates.at(-1)).toMatchObject({
        phase: 'settled',
        observation: { run: { id } }
      })
    }
  )

  it.for([
    {
      name: 'a lost response',
      response: () => Promise.reject(new TypeError('Disconnected'))
    },
    {
      name: 'an invalid success response',
      response: async () => Response.json({ run: id })
    },
    {
      name: 'an idempotency conflict',
      response: async () =>
        Response.json(
          { error: { code: 'idempotency_conflict', message: 'Conflict' } },
          { status: 409 }
        )
    },
    {
      name: 'an upstream service failure',
      response: async () =>
        Response.json(
          {
            error: { code: 'temporarily_unavailable', message: 'Unavailable' }
          },
          { status: 503 }
        )
    },
    {
      name: 'a rejection code returned as a server error',
      response: async () =>
        Response.json(
          { error: { code: 'invalid_input', message: 'Invalid' } },
          { status: 500 }
        )
    }
  ])(
    'preserves and replays the prepared intent after $name',
    async ({ response }) => {
      const f = fixture()
      f.fetch.mockImplementationOnce(response)
      await f.controller.start(input)
      const originalBody = f.fetch.mock.calls[0][1]?.body
      const originalKey = new Headers(f.fetch.mock.calls[0][1]?.headers).get(
        'Idempotency-Key'
      )
      const saved = f.storage.read()
      await f.controller.start({
        image: 'https://storage.googleapis.com/inputs/different'
      })
      expect(f.fetch).toHaveBeenCalledOnce()
      expect(f.storage.read()).toEqual(saved)
      expect(f.updates.at(-1)).toMatchObject({
        phase: 'interrupted',
        record: { stage: 'intent', attempt: { request: { appInputs: input } } }
      })
      f.fetch
        .mockResolvedValueOnce(
          Response.json(f.observation('submitting').run, { status: 202 })
        )
        .mockResolvedValueOnce(Response.json(f.observation('succeeded')))
      await f.controller.resume()
      expect(f.fetch.mock.calls[1][1]?.body).toBe(originalBody)
      expect(
        new Headers(f.fetch.mock.calls[1][1]?.headers).get('Idempotency-Key')
      ).toBe(originalKey)
      expect(f.storage.read()).toMatchObject({
        stage: 'run',
        runId: id,
        appInputs: input
      })
    }
  )

  it('retains a rejected intent when its recovery record cannot be cleared', async () => {
    const f = fixture()
    const storage = workflowStorage(
      {
        getItem: (key) => sessionStorage.getItem(key),
        setItem: (key, value) => sessionStorage.setItem(key, value),
        removeItem() {
          throw new DOMException('Storage is unavailable', 'SecurityError')
        }
      },
      'user:workspace',
      f.model.workflowId
    )
    const controller = createWorkflowController({
      model: f.model,
      api: f.api,
      storage,
      onChange: (state) => f.updates.push(state)
    })
    onTestFinished(() => controller.dispose())
    f.fetch.mockResolvedValueOnce(
      Response.json(
        { error: { code: 'invalid_input', message: 'Rejected' } },
        { status: 422 }
      )
    )
    await controller.start(input)
    await controller.start({
      image: 'https://storage.googleapis.com/inputs/different'
    })
    expect(f.fetch).toHaveBeenCalledOnce()
    expect(f.updates.at(-1)).toMatchObject({
      phase: 'interrupted',
      error: new WorkshopWorkflowError('persistence')
    })
    expect(storage.read()).toMatchObject({
      stage: 'intent',
      attempt: { request: { appInputs: input } }
    })
  })

  const replacementActions = [
    {
      name: 'another Generate action',
      replace: (f: ReturnType<typeof fixture>) =>
        f.controller.start({
          image: 'https://storage.googleapis.com/inputs/different'
        })
    },
    {
      name: 'a history entry',
      replace: (f: ReturnType<typeof fixture>) =>
        f.controller.open(f.observation('succeeded', otherId).run)
    }
  ]

  it.for(replacementActions)(
    'does not let $name discard an uncertain submission',
    async ({ replace }) => {
      const f = fixture()
      f.fetch.mockRejectedValueOnce(new TypeError('Lost response'))
      await f.controller.start(input)
      const saved = f.storage.read()
      await replace(f)
      expect(f.fetch).toHaveBeenCalledOnce()
      expect(f.storage.read()).toEqual(saved)
      expect(f.updates.at(-1)).toMatchObject({
        phase: 'interrupted',
        record: {
          stage: 'intent',
          attempt: { request: { appInputs: input } }
        }
      })
    }
  )

  it.for(replacementActions)(
    'does not let $name replace a run being observed',
    async ({ replace }) => {
      const f = fixture()
      const reading = Promise.withResolvers<void>()
      const result = Promise.withResolvers<Response>()
      f.fetch
        .mockResolvedValueOnce(
          Response.json(f.observation('submitting').run, { status: 202 })
        )
        .mockImplementationOnce(async () => {
          reading.resolve()
          return result.promise
        })
      const active = f.controller.start(input)
      onTestFinished(async () => {
        f.controller.dispose()
        result.resolve(Response.json(f.observation('succeeded')))
        await active
      })
      await reading.promise
      const saved = f.storage.read()
      await replace(f)
      expect(f.storage.read()).toEqual(saved)
      result.resolve(Response.json(f.observation('succeeded')))
      await active
      expect(f.fetch).toHaveBeenCalledTimes(2)
      expect(f.updates.at(-1)).toMatchObject({
        phase: 'settled',
        observation: { run: { id, state: 'succeeded' } }
      })
    }
  )

  type Fixture = ReturnType<typeof fixture>
  type DeferredResponse = ReturnType<typeof Promise.withResolvers<Response>>
  const deliveryActions = [
    {
      name: 'a successful output refresh',
      run: (f: Fixture) => f.controller.refreshOutput(outputId),
      complete: (response: DeferredResponse, f: Fixture) =>
        response.resolve(Response.json(f.access()))
    },
    {
      name: 'a failed output refresh',
      run: (f: Fixture) => f.controller.refreshOutput(outputId),
      complete: (response: DeferredResponse) =>
        response.reject(new TypeError('Delivery unavailable'))
    },
    {
      name: 'a successful delivery retry',
      run: (f: Fixture) => f.controller.retryDelivery(),
      complete: (response: DeferredResponse, f: Fixture) =>
        response.resolve(Response.json(f.delivered(), { status: 202 }))
    },
    {
      name: 'a failed delivery retry',
      run: (f: Fixture) => f.controller.retryDelivery(),
      complete: (response: DeferredResponse) =>
        response.reject(new TypeError('Delivery unavailable'))
    }
  ]
  const deliveryContexts = [
    {
      context: 'another history run is selected',
      change: async (f: Fixture) => {
        const another = f.observation('succeeded', otherId)
        f.fetch.mockResolvedValueOnce(Response.json(another))
        await f.controller.open(another.run)
      }
    },
    {
      context: 'the controller is disposed',
      change: (f: Fixture) => f.controller.dispose()
    }
  ]

  it.for(
    deliveryActions.flatMap((action) =>
      deliveryContexts.map((context) => ({ ...action, ...context }))
    )
  )('ignores $name after $context', async ({ run, complete, change }) => {
    const f = fixture()
    const original = f.delivered()
    f.fetch.mockResolvedValueOnce(Response.json(original))
    await f.controller.open(original.run)
    const requesting = Promise.withResolvers<void>()
    const response = Promise.withResolvers<Response>()
    f.fetch.mockImplementationOnce(async () => {
      requesting.resolve()
      return response.promise
    })
    const pending = run(f)
    onTestFinished(async () => {
      f.controller.dispose()
      response.resolve(Response.json(f.delivered()))
      await pending
    })
    await requesting.promise
    await change(f)
    const current = f.updates.at(-1)
    const saved = f.storage.read()
    const requests = f.fetch.mock.calls.length
    complete(response, f)
    await pending
    expect(f.updates.at(-1)).toEqual(current)
    expect(f.storage.read()).toEqual(saved)
    expect(f.fetch).toHaveBeenCalledTimes(requests)
  })
})
