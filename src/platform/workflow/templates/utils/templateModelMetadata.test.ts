import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ModelMetadataFetchOutcome } from '@/platform/missingModel/missingModelDownload'
import type { ModelFile } from '@/platform/workflow/validation/schemas/workflowSchema'
import { resolveTemplateModelMetadata } from './templateModelMetadata'

const mocks = vi.hoisted(() => ({
  fetchModelMetadataWithStatus: vi.fn()
}))

vi.mock('@/platform/missingModel/missingModelDownload', () => ({
  fetchModelMetadataWithStatus: mocks.fetchModelMetadataWithStatus
}))

function model(name: string, url = `https://example.com/${name}`): ModelFile {
  return { name, url, directory: 'checkpoints' }
}

function metadataOutcome(
  fileSize: number | null,
  gatedRepoUrl: string | null = null,
  resolution: ModelMetadataFetchOutcome['resolution'] = 'resolved'
): ModelMetadataFetchOutcome {
  return { metadata: { fileSize, gatedRepoUrl }, resolution }
}

function metadataEntry(
  model: ModelFile,
  fileSize: number | null,
  gatedRepoUrl: string | null = null,
  resolution: ModelMetadataFetchOutcome['resolution'] = 'resolved'
) {
  return { model, fileSize, gatedRepoUrl, resolution }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}

describe('resolveTemplateModelMetadata', () => {
  beforeEach(() => {
    mocks.fetchModelMetadataWithStatus.mockReset()
  })

  it('fetches each URL once while preserving input order and repeated identity', async () => {
    const shared = model('shared.safetensors')
    const unique = model('unique.safetensors')
    mocks.fetchModelMetadataWithStatus.mockImplementation(
      async (url: string) =>
        url === shared.url
          ? metadataOutcome(1024)
          : metadataOutcome(null, 'https://huggingface.co/org/gated-model')
    )

    const result = await resolveTemplateModelMetadata([shared, unique, shared])

    expect(mocks.fetchModelMetadataWithStatus).toHaveBeenCalledTimes(2)
    expect(mocks.fetchModelMetadataWithStatus).toHaveBeenNthCalledWith(
      1,
      shared.url
    )
    expect(mocks.fetchModelMetadataWithStatus).toHaveBeenNthCalledWith(
      2,
      unique.url
    )
    expect(result).toEqual({
      status: 'completed',
      entries: [
        metadataEntry(shared, 1024),
        metadataEntry(unique, null, 'https://huggingface.co/org/gated-model'),
        metadataEntry(shared, 1024)
      ]
    })
    if (result.status !== 'completed') {
      throw new Error('Expected completed metadata')
    }
    expect(result.entries[0]?.model).toBe(shared)
    expect(result.entries[2]?.model).toBe(shared)
  })

  it('preserves a failed URL outcome while resolving the remaining models', async () => {
    const first = model('first.safetensors')
    const failed = model('failed.safetensors')
    const last = model('last.safetensors')
    mocks.fetchModelMetadataWithStatus.mockImplementation(
      async (url: string) => {
        if (url === failed.url) {
          return metadataOutcome(null, null, 'failed')
        }
        return metadataOutcome(url === first.url ? 100 : 300)
      }
    )

    await expect(
      resolveTemplateModelMetadata([first, failed, last])
    ).resolves.toEqual({
      status: 'completed',
      entries: [
        metadataEntry(first, 100),
        metadataEntry(failed, null, null, 'failed'),
        metadataEntry(last, 300)
      ]
    })
    expect(mocks.fetchModelMetadataWithStatus).toHaveBeenCalledTimes(3)
  })

  it('does not fetch metadata for an empty batch', async () => {
    await expect(resolveTemplateModelMetadata([])).resolves.toEqual({
      status: 'completed',
      entries: []
    })
    expect(mocks.fetchModelMetadataWithStatus).not.toHaveBeenCalled()
  })

  it('does not start an already-aborted batch', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      resolveTemplateModelMetadata([model('aborted.safetensors')], {
        signal: controller.signal
      })
    ).resolves.toEqual({ status: 'aborted' })
    expect(mocks.fetchModelMetadataWithStatus).not.toHaveBeenCalled()
  })

  it('forwards its cancellation signal to each unique metadata request', async () => {
    const controller = new AbortController()
    const first = model('first.safetensors')
    const second = model('second.safetensors')
    mocks.fetchModelMetadataWithStatus.mockResolvedValue(metadataOutcome(1024))

    await resolveTemplateModelMetadata([first, second, first], {
      signal: controller.signal
    })

    expect(mocks.fetchModelMetadataWithStatus).toHaveBeenCalledTimes(2)
    expect(mocks.fetchModelMetadataWithStatus).toHaveBeenNthCalledWith(
      1,
      first.url,
      { signal: controller.signal }
    )
    expect(mocks.fetchModelMetadataWithStatus).toHaveBeenNthCalledWith(
      2,
      second.url,
      { signal: controller.signal }
    )
  })

  it('discards a completed batch when it is aborted while metadata is pending', async () => {
    const controller = new AbortController()
    const pending = deferred<ModelMetadataFetchOutcome>()
    mocks.fetchModelMetadataWithStatus.mockReturnValueOnce(pending.promise)
    const result = resolveTemplateModelMetadata(
      [model('pending.safetensors')],
      {
        signal: controller.signal
      }
    )

    expect(mocks.fetchModelMetadataWithStatus).toHaveBeenCalledOnce()
    controller.abort()
    pending.resolve(metadataOutcome(2048))

    await expect(result).resolves.toEqual({ status: 'aborted' })
  })
})
