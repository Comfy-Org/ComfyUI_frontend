import { beforeEach, expect, it, vi } from 'vitest'

import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { api } from '@/scripts/api'

import { usePortableModelDownloadStore } from './portableModelDownloadStore'

const model = {
  name: 'model.safetensors',
  directory: 'vae',
  url: 'https://huggingface.co/org/model/resolve/main/model.safetensors'
}

function response(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

beforeEach(() => {
  sessionStorage.clear()
})

it('queues models once and tracks completion until the missing-model scan refreshes', async () => {
  vi.useFakeTimers()
  const fetchApi = vi.spyOn(api, 'fetchApi')
  const refresh = vi
    .spyOn(useMissingModelStore(), 'refreshMissingModels')
    .mockResolvedValue(undefined)
  fetchApi
    .mockResolvedValueOnce(
      response(202, {
        batch_id: 'batch-1',
        models: [
          {
            name: model.name,
            directory: model.directory,
            status: 'queued',
            bytes_downloaded: 0,
            bytes_total: null,
            error: null
          }
        ]
      })
    )
    .mockResolvedValueOnce(
      response(200, {
        models: [
          {
            name: model.name,
            directory: model.directory,
            status: 'completed',
            bytes_downloaded: 12,
            bytes_total: 12,
            error: null
          }
        ]
      })
    )

  const store = usePortableModelDownloadStore()
  await store.start([model])
  await store.start([model])

  expect(fetchApi).toHaveBeenCalledTimes(1)
  expect(fetchApi).toHaveBeenCalledWith('/models/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ models: [model] })
  })
  expect(store.state.phase).toBe('running')

  await vi.advanceTimersByTimeAsync(2000)

  expect(fetchApi).toHaveBeenLastCalledWith('/models/download/batch-1')
  expect(store.state.phase).toBe('finished')
  expect(refresh).toHaveBeenCalledWith({ reloadDefs: true })
  expect(sessionStorage.getItem('Comfy.PortableModelDownloadBatch')).toBeNull()
  store.$dispose()
  vi.useRealTimers()
})

it('explains when an older portable backend has no batch endpoint', async () => {
  vi.spyOn(api, 'fetchApi').mockResolvedValue(response(404, {}))

  const store = usePortableModelDownloadStore()
  await store.start([model])

  expect(store.state).toEqual({ phase: 'error', reason: 'unavailable' })
  store.$dispose()
})
