import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

/**
 * Unit tests for the jobs-namespace cancel client methods.
 *
 * These methods target the state-agnostic cancel endpoints:
 *   - single: POST /api/jobs/{job_id}/cancel
 *   - batch:  POST /api/jobs/cancel with body { job_ids: [...] }
 *
 * `fetchApi` (the network layer) is stubbed so the tests assert the request
 * shape and the throw-on-failure behavior without hitting a server.
 */
const okResponse = () => ({ ok: true, status: 200 }) as Response
const errorResponse = (status: number) =>
  ({ ok: false, status }) as Response

describe('api jobs-namespace cancel', () => {
  let fetchApiSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchApiSpy = vi.spyOn(api, 'fetchApi').mockResolvedValue(okResponse())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('cancelJob (single)', () => {
    it('POSTs to the single-job cancel endpoint', async () => {
      await api.cancelJob('abc-123')

      expect(fetchApiSpy).toHaveBeenCalledWith('/jobs/abc-123/cancel', {
        method: 'POST'
      })
    })

    it('encodes the job id in the path', async () => {
      await api.cancelJob('a/b c')

      expect(fetchApiSpy).toHaveBeenCalledWith('/jobs/a%2Fb%20c/cancel', {
        method: 'POST'
      })
    })

    it('throws when the request fails', async () => {
      fetchApiSpy.mockResolvedValueOnce(errorResponse(500))

      await expect(api.cancelJob('abc-123')).rejects.toThrow(
        'Failed to cancel job abc-123: 500'
      )
    })
  })

  describe('cancelJobs (batch)', () => {
    it('POSTs the job_ids array to the batch cancel endpoint', async () => {
      await api.cancelJobs(['id-1', 'id-2'])

      expect(fetchApiSpy).toHaveBeenCalledWith('/jobs/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ job_ids: ['id-1', 'id-2'] })
      })
    })

    it('does not call the API for an empty list', async () => {
      await api.cancelJobs([])

      expect(fetchApiSpy).not.toHaveBeenCalled()
    })

    it('throws when the batch request fails', async () => {
      fetchApiSpy.mockResolvedValueOnce(errorResponse(500))

      await expect(api.cancelJobs(['id-1'])).rejects.toThrow(
        'Failed to cancel jobs: 500'
      )
    })
  })
})
