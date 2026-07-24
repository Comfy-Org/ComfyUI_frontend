import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import { DownloadApiError } from '../types'
import {
  cancelDownload,
  checkAvailability,
  clearDownloads,
  deleteDownload,
  enqueueDownload,
  getDownloadAuth,
  listDownloads,
  logoutProvider,
  pauseDownload,
  resumeDownload,
  setDownloadPriority,
  startProviderLogin
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

  describe('auth', () => {
    it('unwraps the provider status list from GET /download/auth', async () => {
      fetchApi.mockResolvedValue(
        jsonResponse(200, {
          providers: [
            {
              provider: 'huggingface',
              env_key_present: true,
              logged_in: false,
              login_in_progress: false
            }
          ]
        })
      )

      const result = await getDownloadAuth()

      expect(fetchApi).toHaveBeenCalledWith('/download/auth')
      expect(result).toEqual([
        {
          provider: 'huggingface',
          env_key_present: true,
          logged_in: false,
          login_in_progress: false
        }
      ])
    })

    it('posts to the provider login route and returns the authorize url', async () => {
      fetchApi.mockResolvedValue(
        jsonResponse(200, { authorize_url: 'https://auth.example/go' })
      )

      const result = await startProviderLogin('huggingface')

      expect(fetchApi).toHaveBeenCalledWith(
        '/download/auth/huggingface/login',
        expect.objectContaining({ method: 'POST' })
      )
      expect(result).toEqual({ authorize_url: 'https://auth.example/go' })
    })

    it('surfaces OAUTH_NOT_CONFIGURED as a DownloadApiError', async () => {
      fetchApi.mockResolvedValue(
        jsonResponse(400, {
          error: { code: 'OAUTH_NOT_CONFIGURED', message: 'no client id' }
        })
      )

      const error = await startProviderLogin('civitai').catch((e) => e)

      expect(error).toBeInstanceOf(DownloadApiError)
      expect(error.is('OAUTH_NOT_CONFIGURED')).toBe(true)
    })

    it('posts to the provider logout route', async () => {
      fetchApi.mockResolvedValue(jsonResponse(200, { logged_out: true }))

      await logoutProvider('civitai')

      expect(fetchApi).toHaveBeenCalledWith(
        '/download/auth/civitai/logout',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })
})
