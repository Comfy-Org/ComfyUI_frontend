import { describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'
import {
  cancelMissingModelDownload,
  downloadMissingModels
} from './modelDownload'

vi.mock(import('@/scripts/api'))

const model = {
  name: 'model.safetensors',
  directory: 'checkpoints',
  url: 'https://huggingface.co/org/model/resolve/main/model.safetensors'
}

describe('model download requests', () => {
  it.for(['download', 'cancel'])(
    'surfaces non-success HTTP responses from %s',
    async (operation) => {
      vi.mocked(api.fetchApi).mockResolvedValue(
        new Response(JSON.stringify({ message: 'Download task not found' }), {
          status: 404
        })
      )
      const request =
        operation === 'download'
          ? downloadMissingModels([model], 'client', 'batch')
          : cancelMissingModelDownload('task', 'client', 'batch')
      await expect(request).resolves.toMatchObject({
        ok: false,
        error: new Error('HTTP 404: Download task not found')
      })
      const options = vi.mocked(api.fetchApi).mock.calls[0][1]
      expect(options?.timeoutMs).toBe(
        operation === 'download' ? null : undefined
      )
    }
  )

  it('sends the batch identity and validates the response', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(
      new Response(
        JSON.stringify({
          downloaded: 1,
          skipped: 0,
          canceled: 0,
          failed: 0,
          results: [{ ...model, status: 'downloaded' }]
        })
      )
    )
    const result = await downloadMissingModels([model], 'client', 'batch')
    expect(result).toMatchObject({ ok: true, value: { downloaded: 1 } })
    expect(api.fetchApi).toHaveBeenCalledWith(
      '/experiment/models/download_missing',
      expect.objectContaining({
        body: JSON.stringify({
          models: [model],
          client_id: 'client',
          batch_id: 'batch'
        })
      })
    )
    vi.mocked(api.fetchApi).mockResolvedValue(new Response('{}'))
    await expect(
      downloadMissingModels([model], 'client', 'batch')
    ).resolves.toMatchObject({ ok: false })
  })

  it('includes a supplied token only in the download request body', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(new Response('{}'))
    await downloadMissingModels([model], 'client', 'batch', 'hf_test')
    expect(api.fetchApi).toHaveBeenLastCalledWith(
      '/experiment/models/download_missing',
      expect.objectContaining({
        body: JSON.stringify({
          models: [model],
          client_id: 'client',
          batch_id: 'batch',
          hf_token: 'hf_test'
        })
      })
    )
    await cancelMissingModelDownload('task', 'client', 'batch')
    expect(api.fetchApi).toHaveBeenLastCalledWith(
      '/experiment/models/download_missing/cancel',
      expect.objectContaining({
        body: JSON.stringify({
          task_id: 'task',
          client_id: 'client',
          batch_id: 'batch'
        })
      })
    )
  })
})
