import { describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import { taskService } from './taskService'

vi.mock(import('@/scripts/api'))

describe('taskService.cancelTask', () => {
  it('requests cancellation through the owned task endpoint', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(
      new Response(null, { status: 204 })
    )

    await expect(taskService.cancelTask('task-123')).resolves.toBe(true)

    expect(api.fetchApi).toHaveBeenCalledWith('/tasks/task-123', {
      method: 'DELETE'
    })
  })

  it.for([404, 409])(
    'treats a %s terminal race as idempotent',
    async (status) => {
      vi.mocked(api.fetchApi).mockResolvedValue(new Response(null, { status }))

      await expect(taskService.cancelTask('task-123')).resolves.toBe(false)
    }
  )

  it('surfaces rejected cancellations with response detail', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(
      new Response('queue unavailable', { status: 503 })
    )

    await expect(taskService.cancelTask('task-123')).rejects.toThrow(
      'Failed to cancel task task-123: 503 queue unavailable'
    )
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
})
