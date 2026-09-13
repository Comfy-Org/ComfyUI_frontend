import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import { taskService } from './taskService'

vi.mock<unknown>(import('@/scripts/api'), () => ({
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

  it('returns a valid task response', async () => {
    const task = {
      id: '4d1453c1-ec17-4a50-b6a3-34d49ba1b09f',
      idempotency_key: 'download-model',
      task_name: 'task:download_file',
      payload: { url: 'https://example.com/model.safetensors' },
      status: 'completed',
      result: {
        success: true,
        filename: 'model.safetensors',
        bytes_downloaded: 1024
      },
      create_time: '2026-09-10T12:00:00.000Z',
      update_time: '2026-09-10T12:01:00.000Z',
      completed_at: '2026-09-10T12:01:00.000Z'
    }
    vi.mocked(api.fetchApi).mockResolvedValue(Response.json(task))

    await expect(taskService.getTask(task.id)).resolves.toEqual(task)
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
