import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import { DownloadApiError } from '../types'
import {
  cancelDownload,
  checkAvailability,
  clearDownloads,
  deleteCredential,
  deleteDownload,
  enqueueDownload,
  listCredentials,
  listDownloads,
  pauseDownload,
  resumeDownload,
  setDownloadPriority,
  upsertCredential
} from './modelDownloadApi'

vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: vi.fn()
  }
}))

const fetchApi = vi.mocked(api.fetchApi)

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `status ${status}`,
    json: () => Promise.resolve(body)
  } as unknown as Response
}

function nonJsonErrorResponse(status: number, statusText: string): Response {
  return {
    ok: false,
    status,
    statusText,
    json: () => Promise.reject(new Error('not json'))
  } as unknown as Response
}

describe('modelDownloadApi', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('enqueueDownload', () => {
    it('returns the enqueue response on 202', async () => {
      fetchApi.mockResolvedValue(
        jsonResponse(202, { download_id: 'd1', accepted: true })
      )

      const result = await enqueueDownload({
        url: 'https://huggingface.co/x.safetensors',
        model_id: 'loras/x.safetensors'
      })

      expect(result).toEqual({ download_id: 'd1', accepted: true })
      expect(fetchApi).toHaveBeenCalledWith(
        '/download/enqueue',
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('throws a DownloadApiError carrying the error code on 409', async () => {
      fetchApi.mockResolvedValue(
        jsonResponse(409, {
          error: { code: 'ALREADY_DOWNLOADING', message: 'exists' }
        })
      )

      await expect(
        enqueueDownload({ url: 'u', model_id: 'loras/x.safetensors' })
      ).rejects.toMatchObject({
        code: 'ALREADY_DOWNLOADING',
        status: 409,
        message: 'exists'
      })
    })

    it('falls back to statusText and an UNKNOWN code for a non-JSON error body', async () => {
      fetchApi.mockResolvedValue(nonJsonErrorResponse(502, 'Bad Gateway'))

      await expect(
        enqueueDownload({ url: 'u', model_id: 'loras/x.safetensors' })
      ).rejects.toMatchObject({
        message: 'Bad Gateway',
        code: 'UNKNOWN',
        status: 502
      })
    })

    it('exposes the code through DownloadApiError.is()', async () => {
      fetchApi.mockResolvedValue(
        jsonResponse(400, {
          error: { code: 'URL_NOT_ALLOWED', message: 'nope' }
        })
      )

      const error = await enqueueDownload({
        url: 'u',
        model_id: 'loras/x.safetensors'
      }).catch((e) => e)

      expect(error).toBeInstanceOf(DownloadApiError)
      expect(error.is('URL_NOT_ALLOWED')).toBe(true)
    })
  })

  describe('listDownloads', () => {
    it('unwraps the downloads array', async () => {
      fetchApi.mockResolvedValue(
        jsonResponse(200, { downloads: [{ download_id: 'd1' }] })
      )

      const result = await listDownloads()

      expect(result).toEqual([{ download_id: 'd1' }])
    })
  })

  describe('actions', () => {
    it('posts to the pause route', async () => {
      fetchApi.mockResolvedValue(jsonResponse(200, { ok: true }))

      await pauseDownload('d1')

      expect(fetchApi).toHaveBeenCalledWith(
        '/download/d1/pause',
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('posts to the resume route', async () => {
      fetchApi.mockResolvedValue(jsonResponse(200, { ok: true }))

      await resumeDownload('d1')

      expect(fetchApi).toHaveBeenCalledWith(
        '/download/d1/resume',
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('posts to the cancel route', async () => {
      fetchApi.mockResolvedValue(jsonResponse(200, { ok: true }))

      await cancelDownload('d1')

      expect(fetchApi).toHaveBeenCalledWith(
        '/download/d1/cancel',
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('sends the priority in the body', async () => {
      fetchApi.mockResolvedValue(jsonResponse(200, { ok: true }))

      await setDownloadPriority('d1', 5)

      expect(fetchApi).toHaveBeenCalledWith(
        '/download/d1/priority',
        expect.objectContaining({ body: JSON.stringify({ priority: 5 }) })
      )
    })

    it('sends a DELETE to the download route', async () => {
      fetchApi.mockResolvedValue(jsonResponse(200, { deleted: true }))

      await deleteDownload('d1')

      expect(fetchApi).toHaveBeenCalledWith(
        '/download/d1',
        expect.objectContaining({ method: 'DELETE' })
      )
    })

    it('posts to the clear route and returns the deleted count', async () => {
      fetchApi.mockResolvedValue(jsonResponse(200, { deleted: 3 }))

      const result = await clearDownloads()

      expect(result).toBe(3)
      expect(fetchApi).toHaveBeenCalledWith(
        '/download/clear',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  describe('checkAvailability', () => {
    it('wraps the models map in the request body', async () => {
      fetchApi.mockResolvedValue(jsonResponse(200, { models: {} }))

      await checkAvailability({ 'loras/x.safetensors': 'https://h.co/x' })

      expect(fetchApi).toHaveBeenCalledWith(
        '/download/availability',
        expect.objectContaining({
          body: JSON.stringify({
            models: { 'loras/x.safetensors': 'https://h.co/x' }
          })
        })
      )
    })
  })

  describe('credentials', () => {
    it('unwraps the credentials list', async () => {
      fetchApi.mockResolvedValue(
        jsonResponse(200, { credentials: [{ id: 'c1' }] })
      )

      expect(await listCredentials()).toEqual([{ id: 'c1' }])
    })

    it('returns the created credential view', async () => {
      fetchApi.mockResolvedValue(jsonResponse(201, { id: 'c1', host: 'h' }))

      const result = await upsertCredential({ host: 'h', secret: 's' })

      expect(result).toEqual({ id: 'c1', host: 'h' })
    })

    it('throws on a failed delete', async () => {
      fetchApi.mockResolvedValue(
        jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'gone' } })
      )

      await expect(deleteCredential('c1')).rejects.toMatchObject({
        code: 'NOT_FOUND'
      })
    })
  })
})
