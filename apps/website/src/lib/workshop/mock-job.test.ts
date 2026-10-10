import { describe, expect, it, vi } from 'vitest'

import { mockJob } from './mock-job'

describe('mockJob', () => {
  it('answers after its delay', async () => {
    vi.useFakeTimers()
    const job = mockJob('done', new AbortController().signal, 1000)

    await vi.advanceTimersByTimeAsync(1000)

    await expect(job).resolves.toBe('done')
  })

  it('rejects when aborted before it answers', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const job = mockJob('done', controller.signal, 1000)

    controller.abort(new Error('cancelled'))

    await expect(job).rejects.toThrow('cancelled')
  })

  it('rejects at once on a signal that is already aborted', async () => {
    await expect(
      mockJob('done', AbortSignal.abort(new Error('cancelled')), 1000)
    ).rejects.toThrow('cancelled')
  })
})
