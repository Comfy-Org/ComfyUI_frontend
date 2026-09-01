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

  it('starts at most six unique metadata requests at once', async () => {
    const models = Array.from({ length: 7 }, (_, index) =>
      model(`model-${index}.safetensors`)
    )
    const pendingByUrl = new Map<
      string,
      ReturnType<typeof deferred<ModelMetadataFetchOutcome>>
    >()
    mocks.fetchModelMetadataWithStatus.mockImplementation((url: string) => {
      const pending = deferred<ModelMetadataFetchOutcome>()
      pendingByUrl.set(url, pending)
      return pending.promise
    })

    const result = resolveTemplateModelMetadata(models)
    await Promise.resolve()

    expect(mocks.fetchModelMetadataWithStatus).toHaveBeenCalledTimes(6)
    expect(
      mocks.fetchModelMetadataWithStatus.mock.calls.some(
        ([url]) => url === models[6].url
      )
    ).toBe(false)

    pendingByUrl.get(models[0].url)?.resolve(metadataOutcome(100))
    await vi.waitFor(() => {
      expect(mocks.fetchModelMetadataWithStatus).toHaveBeenCalledTimes(7)
    })

    for (const pending of pendingByUrl.values()) {
      pending.resolve(metadataOutcome(100))
    }
    await expect(result).resolves.toMatchObject({
      status: 'completed',
      entries: expect.arrayContaining([
        expect.objectContaining({ model: models[6] })
      ])
    })
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

  it('settles promptly when aborted even if metadata never settles', async () => {
    const controller = new AbortController()
    mocks.fetchModelMetadataWithStatus.mockReturnValueOnce(
      new Promise<ModelMetadataFetchOutcome>(() => {})
    )
    const result = resolveTemplateModelMetadata(
      [model('pending.safetensors')],
      {
        signal: controller.signal
      }
    )

    expect(mocks.fetchModelMetadataWithStatus).toHaveBeenCalledOnce()
    let outcome: Awaited<typeof result> | undefined
    void result.then((value) => {
      outcome = value
    })
    controller.abort()

    await vi.waitFor(
      () => {
        expect(outcome).toEqual({ status: 'aborted' })
      },
      { interval: 5, timeout: 100 }
    )
  })

  it('aborts a metadata request after ten seconds and records failure', async () => {
    vi.useFakeTimers()
    try {
      let requestSignal: AbortSignal | undefined
      mocks.fetchModelMetadataWithStatus.mockImplementation(
        (_url: string, options?: { signal?: AbortSignal }) => {
          requestSignal = options?.signal
          return new Promise<ModelMetadataFetchOutcome>(() => {})
        }
      )
      const timedOut = model('timed-out.safetensors')
      const result = resolveTemplateModelMetadata([timedOut])
      await Promise.resolve()

      expect(requestSignal).toBeDefined()
      expect(requestSignal?.aborted).toBe(false)

      await vi.advanceTimersByTimeAsync(10_000)

      expect(requestSignal?.aborted).toBe(true)
      await expect(result).resolves.toEqual({
        status: 'completed',
        entries: [metadataEntry(timedOut, null, null, 'failed')]
      })
    } finally {
      vi.useRealTimers()
    }
  })
})
