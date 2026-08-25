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

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, reject, resolve }
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
          ? {
              metadata: { fileSize: 1024, gatedRepoUrl: null },
              resolution: 'resolved'
            }
          : {
              metadata: {
                fileSize: null,
                gatedRepoUrl: 'https://huggingface.co/org/gated-model'
              },
              resolution: 'resolved'
            }
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
        {
          model: shared,
          fileSize: 1024,
          gatedRepoUrl: null,
          resolution: 'resolved'
        },
        {
          model: unique,
          fileSize: null,
          gatedRepoUrl: 'https://huggingface.co/org/gated-model',
          resolution: 'resolved'
        },
        {
          model: shared,
          fileSize: 1024,
          gatedRepoUrl: null,
          resolution: 'resolved'
        }
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
          return {
            metadata: { fileSize: null, gatedRepoUrl: null },
            resolution: 'failed'
          }
        }
        return {
          metadata: {
            fileSize: url === first.url ? 100 : 300,
            gatedRepoUrl: null
          },
          resolution: 'resolved'
        }
      }
    )

    await expect(
      resolveTemplateModelMetadata([first, failed, last])
    ).resolves.toEqual({
      status: 'completed',
      entries: [
        {
          model: first,
          fileSize: 100,
          gatedRepoUrl: null,
          resolution: 'resolved'
        },
        {
          model: failed,
          fileSize: null,
          gatedRepoUrl: null,
          resolution: 'failed'
        },
        {
          model: last,
          fileSize: 300,
          gatedRepoUrl: null,
          resolution: 'resolved'
        }
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
    pending.resolve({
      metadata: { fileSize: 2048, gatedRepoUrl: null },
      resolution: 'resolved'
    })

    await expect(result).resolves.toEqual({ status: 'aborted' })
  })
})
