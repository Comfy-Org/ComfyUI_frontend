import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import { taskService } from './taskService'

vi.mock('@/scripts/api', () => ({
  api: { fetchApi: vi.fn() }
}))

describe('taskService.getTask', () => {
  beforeEach(() => {
    vi.mocked(api.fetchApi).mockResolvedValue(
      new Response(null, { status: 404 })
    )
  })

  it('returns undefined when the task does not exist', async () => {
    await expect(taskService.getTask('missing-task')).resolves.toBeUndefined()
  })

  it('rejects other HTTP failures', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(
      new Response(null, { status: 500 })
    )

    await expect(taskService.getTask('task-123')).rejects.toThrow(
      'Failed to get task task-123: 500'
    )
  })

  it('rejects invalid task responses', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(
      Response.json({ status: 'completed' })
    )

    await expect(taskService.getTask('task-123')).rejects.toThrow()
  })
})
