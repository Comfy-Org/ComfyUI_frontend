import { describe, expect, it, vi } from 'vitest'

import type { ModelFile } from '@/platform/workflow/validation/schemas/workflowSchema'

const mocks = vi.hoisted(() => ({
  fetchModelMetadataWithStatus: vi.fn()
}))

vi.mock('@/platform/missingModel/missingModelDownload', () => ({
  fetchModelMetadataWithStatus: mocks.fetchModelMetadataWithStatus,
  fetchModelMetadata: async (url: string) =>
    (await mocks.fetchModelMetadataWithStatus(url)).metadata
}))

type ModelMetadata = {
  fileSize: number | null
  gatedRepoUrl: string | null
}

type TemplateModelMetadataEntry = ModelMetadata & {
  model: ModelFile
  resolution: 'resolved' | 'failed'
}

type TemplateModelMetadataBatchResult =
  | {
      status: 'completed'
      entries: TemplateModelMetadataEntry[]
    }
  | { status: 'aborted' }

type ResolveTemplateModelMetadata = (
  models: readonly ModelFile[],
  options?: {
    fetchMetadata?: (url: string) => Promise<ModelMetadata>
    signal?: AbortSignal
  }
) => Promise<TemplateModelMetadataBatchResult>

function isMetadataModule(value: unknown): value is {
  resolveTemplateModelMetadata: ResolveTemplateModelMetadata
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    'resolveTemplateModelMetadata' in value &&
    typeof value.resolveTemplateModelMetadata === 'function'
  )
}

async function loadResolver(): Promise<ResolveTemplateModelMetadata> {
  const modulePath = './templateModelMetadata'
  const value: unknown = await import(modulePath)
  if (!isMetadataModule(value)) {
    throw new Error('Expected resolveTemplateModelMetadata to be exported')
  }

  return value.resolveTemplateModelMetadata
}

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
  it('fetches each URL once while preserving input order and repeated identity', async () => {
    const resolveTemplateModelMetadata = await loadResolver()
    const shared = model('shared.safetensors')
    const unique = model('unique.safetensors')
    const fetchMetadata = vi.fn(
      async (url: string): Promise<ModelMetadata> =>
        url === shared.url
          ? { fileSize: 1024, gatedRepoUrl: null }
          : {
              fileSize: null,
              gatedRepoUrl: 'https://huggingface.co/org/gated-model'
            }
    )

    const result = await resolveTemplateModelMetadata(
      [shared, unique, shared],
      { fetchMetadata }
    )

    expect(fetchMetadata).toHaveBeenCalledTimes(2)
    expect(fetchMetadata).toHaveBeenNthCalledWith(1, shared.url)
    expect(fetchMetadata).toHaveBeenNthCalledWith(2, unique.url)
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

  it('marks only a rejected URL as failed and resolves the remaining models', async () => {
    const resolveTemplateModelMetadata = await loadResolver()
    const first = model('first.safetensors')
    const failed = model('failed.safetensors')
    const last = model('last.safetensors')
    const fetchMetadata = vi.fn(async (url: string): Promise<ModelMetadata> => {
      if (url === failed.url) throw new Error('Metadata unavailable')
      return {
        fileSize: url === first.url ? 100 : 300,
        gatedRepoUrl: null
      }
    })

    await expect(
      resolveTemplateModelMetadata([first, failed, last], { fetchMetadata })
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
    expect(fetchMetadata).toHaveBeenCalledTimes(3)
  })

  it('marks a default production metadata failure as failed', async () => {
    const resolveTemplateModelMetadata = await loadResolver()
    const failed = model(
      'not-found.safetensors',
      'https://huggingface.co/org/model/resolve/main/not-found.safetensors'
    )
    mocks.fetchModelMetadataWithStatus.mockResolvedValueOnce({
      metadata: { fileSize: null, gatedRepoUrl: null },
      resolution: 'failed'
    })

    await expect(resolveTemplateModelMetadata([failed])).resolves.toEqual({
      status: 'completed',
      entries: [
        {
          model: failed,
          fileSize: null,
          gatedRepoUrl: null,
          resolution: 'failed'
        }
      ]
    })
    expect(mocks.fetchModelMetadataWithStatus).toHaveBeenCalledWith(failed.url)
  })

  it('does not fetch metadata for an empty batch', async () => {
    const resolveTemplateModelMetadata = await loadResolver()
    const fetchMetadata = vi.fn()

    await expect(
      resolveTemplateModelMetadata([], { fetchMetadata })
    ).resolves.toEqual({ status: 'completed', entries: [] })
    expect(fetchMetadata).not.toHaveBeenCalled()
  })

  it('does not start an already-aborted batch', async () => {
    const resolveTemplateModelMetadata = await loadResolver()
    const controller = new AbortController()
    const fetchMetadata = vi.fn()
    controller.abort()

    await expect(
      resolveTemplateModelMetadata([model('aborted.safetensors')], {
        fetchMetadata,
        signal: controller.signal
      })
    ).resolves.toEqual({ status: 'aborted' })
    expect(fetchMetadata).not.toHaveBeenCalled()
  })

  it('discards a completed batch when it is aborted while metadata is pending', async () => {
    const resolveTemplateModelMetadata = await loadResolver()
    const controller = new AbortController()
    const pending = deferred<ModelMetadata>()
    const fetchMetadata = vi.fn(() => pending.promise)
    const result = resolveTemplateModelMetadata(
      [model('pending.safetensors')],
      {
        fetchMetadata,
        signal: controller.signal
      }
    )

    expect(fetchMetadata).toHaveBeenCalledOnce()
    controller.abort()
    pending.resolve({ fileSize: 2048, gatedRepoUrl: null })

    await expect(result).resolves.toEqual({ status: 'aborted' })
  })
})
