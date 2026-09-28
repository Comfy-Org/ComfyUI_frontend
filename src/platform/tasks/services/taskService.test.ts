import { describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import { taskService } from './taskService'

vi.mock(import('@/scripts/api'))

describe('taskService.cancelTask', () => {
  it('requests cancellation through the owned task endpoint', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(
      new Response(null, { status: 204 })
    )

    await taskService.cancelTask('task-123')

    expect(api.fetchApi).toHaveBeenCalledWith('/tasks/task-123', {
      method: 'DELETE'
    })
  })

  it('surfaces rejected cancellations', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(
      new Response(null, { status: 409 })
    )

    await expect(taskService.cancelTask('task-123')).rejects.toThrow(
      'Failed to cancel task task-123: 409'
    )
  })
})
