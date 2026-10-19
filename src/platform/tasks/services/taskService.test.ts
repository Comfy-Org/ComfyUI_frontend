import { assert, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import { TaskNotFoundError, taskService } from './taskService'

vi.mock(import('@/scripts/api'))

const taskResponse = {
  id: '1396cc07-bab2-4f12-9b54-741f83f9224c',
  idempotency_key: 'task-key',
  task_name: 'task:download_file',
  payload: {},
  status: 'cancelled',
  create_time: '2026-09-29T00:00:00.000Z',
  update_time: '2026-09-29T00:00:01.000Z'
} as const

describe('taskService.getTask', () => {
  it('parses the generated cancelled task status', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(Response.json(taskResponse))

    await expect(taskService.getTask(taskResponse.id)).resolves.toEqual({
      ok: true,
      value: taskResponse
    })
  })

  it('encodes task ids before placing them in a request path', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(Response.json(taskResponse))

    await taskService.getTask('../task/123')

    expect(api.fetchApi).toHaveBeenCalledWith('/tasks/..%2Ftask%2F123')
  })

  it('returns malformed responses as failures', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(Response.json({ id: 'invalid' }))

    const result = await taskService.getTask('task-123')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toContain('Validation error')
    }
  })

  it('parses a result belonging to another task type', async () => {
    const exportTask = {
      ...taskResponse,
      status: 'completed',
      task_name: 'task:export_assets',
      result: { export_name: 'bundle.zip', assets_total: 3 }
    }
    vi.mocked(api.fetchApi).mockResolvedValue(Response.json(exportTask))

    await expect(taskService.getTask(exportTask.id)).resolves.toEqual({
      ok: true,
      value: exportTask
    })
  })

  it.for([
    { status: 404, message: 'Task not found: task-123' },
    { status: 503, message: 'Failed to get task task-123: 503' }
  ])('returns a $status response as a failure', async ({ status, message }) => {
    vi.mocked(api.fetchApi).mockResolvedValue(new Response(null, { status }))

    const result = await taskService.getTask('task-123')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toBe(message)
    }
  })

  it('distinguishes a missing task from a transient failure', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(
      new Response(null, { status: 404 })
    )
    const missing = await taskService.getTask('task-123')

    vi.mocked(api.fetchApi).mockResolvedValue(
      new Response(null, { status: 503 })
    )
    const transient = await taskService.getTask('task-123')

    assert(!missing.ok)
    assert(!transient.ok)
    expect(missing.error).toBeInstanceOf(TaskNotFoundError)
    expect(transient.error).not.toBeInstanceOf(TaskNotFoundError)
  })

  it('returns network failures as data', async () => {
    const error = new Error('network unavailable')
    vi.mocked(api.fetchApi).mockRejectedValue(error)

    await expect(taskService.getTask('task-123')).resolves.toEqual({
      ok: false,
      error
    })
  })
})

describe('taskService.cancelTask', () => {
  it('requests cancellation through the owned task endpoint', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(
      new Response(null, { status: 204 })
    )

    await expect(taskService.cancelTask('task-123')).resolves.toEqual({
      ok: true,
      value: 'cancelling'
    })

    expect(api.fetchApi).toHaveBeenCalledWith('/tasks/task-123', {
      method: 'DELETE'
    })
  })

  it.for([
    { status: 404, outcome: 'missing' },
    { status: 409, outcome: 'not-cancellable' }
  ])(
    'reports a $status terminal race as $outcome rather than a bare failure',
    async ({ status, outcome }) => {
      vi.mocked(api.fetchApi).mockResolvedValue(new Response(null, { status }))

      await expect(taskService.cancelTask('task-123')).resolves.toEqual({
        ok: true,
        value: outcome
      })
    }
  )

  it('keeps the response body out of rejected cancellation errors', async () => {
    // A 5xx body is typically a gateway's HTML error page or a stack trace,
    // and this message reaches a user-facing toast and telemetry.
    vi.mocked(api.fetchApi).mockResolvedValue(
      new Response(
        '<html><body>nginx: upstream 10.1.2.3 failed</body></html>',
        {
          status: 503
        }
      )
    )

    const result = await taskService.cancelTask('task-123')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toBe('Failed to cancel task task-123: 503')
      expect(result.error.message).not.toContain('nginx')
    }
  })

  it('encodes task ids before placing them in a request path', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(
      new Response(null, { status: 204 })
    )

    await taskService.cancelTask('../task/123')

    expect(api.fetchApi).toHaveBeenCalledWith('/tasks/..%2Ftask%2F123', {
      method: 'DELETE'
    })
  })

  it('returns network failures as data', async () => {
    const error = new Error('network unavailable')
    vi.mocked(api.fetchApi).mockRejectedValue(error)

    await expect(taskService.cancelTask('task-123')).resolves.toEqual({
      ok: false,
      error
    })
  })
})
