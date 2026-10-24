import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

const serverError = () => new Response(null, { status: 500 })

describe('api jobs-namespace reads', () => {
  let fetchApiSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchApiSpy = vi.spyOn(api, 'fetchApi').mockResolvedValue(serverError())
  })

  describe('getQueue', () => {
    it('rejects when asked to throw', async () => {
      await expect(api.getQueue({ throwOnError: true })).rejects.toThrow(
        '[Jobs API] Failed to fetch jobs: 500'
      )
    })

    it('returns an empty queue otherwise', async () => {
      await expect(api.getQueue()).resolves.toEqual({
        Running: [],
        Pending: []
      })
    })

    it('stays silent on an aborted request', async () => {
      fetchApiSpy.mockRejectedValueOnce(
        new DOMException('Aborted', 'AbortError')
      )

      await expect(api.getQueue()).resolves.toEqual({
        Running: [],
        Pending: []
      })
      expect(console.error).not.toHaveBeenCalled()
    })
  })

  describe('getHistory', () => {
    it('rejects when asked to throw', async () => {
      await expect(api.getHistory(200, { throwOnError: true })).rejects.toThrow(
        '[Jobs API] Failed to fetch jobs: 500'
      )
    })

    it('returns an empty history otherwise', async () => {
      await expect(api.getHistory()).resolves.toEqual([])
    })

    it('stays silent on an aborted request', async () => {
      fetchApiSpy.mockRejectedValueOnce(
        new DOMException('Aborted', 'AbortError')
      )

      await expect(api.getHistory()).resolves.toEqual([])
      expect(console.error).not.toHaveBeenCalled()
    })
  })
})
