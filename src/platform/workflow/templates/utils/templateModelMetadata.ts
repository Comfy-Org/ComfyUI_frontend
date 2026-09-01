import { fetchModelMetadataWithStatus } from '@/platform/missingModel/missingModelDownload'
import type {
  ModelMetadata,
  ModelMetadataFetchOutcome
} from '@/platform/missingModel/missingModelDownload'
import type { ModelFile } from '@/platform/workflow/validation/schemas/workflowSchema'

const MAX_CONCURRENT_METADATA_REQUESTS = 6
const METADATA_REQUEST_TIMEOUT_MS = 10_000
const failedMetadata: ModelMetadataFetchOutcome = {
  metadata: { fileSize: null, gatedRepoUrl: null },
  resolution: 'failed'
}

export type TemplateModelMetadataEntry = ModelMetadata & {
  model: ModelFile
  resolution: 'resolved' | 'failed'
}

export type TemplateModelMetadataBatchResult =
  | {
      status: 'completed'
      entries: readonly TemplateModelMetadataEntry[]
    }
  | { status: 'aborted' }

type TemplateModelMetadataOptions = {
  signal?: AbortSignal
}

async function fetchMetadataWithTimeout(
  url: string,
  signal?: AbortSignal
): Promise<ModelMetadataFetchOutcome> {
  const requestController = new AbortController()
  const abortRequest = () => requestController.abort()
  const aborted = new Promise<ModelMetadataFetchOutcome>((resolve) => {
    requestController.signal.addEventListener(
      'abort',
      () => resolve(failedMetadata),
      { once: true }
    )
  })

  if (signal?.aborted) abortRequest()
  else signal?.addEventListener('abort', abortRequest, { once: true })

  const timeout = setTimeout(abortRequest, METADATA_REQUEST_TIMEOUT_MS)
  const request = (() => {
    try {
      return requestController.signal.aborted
        ? Promise.resolve(failedMetadata)
        : fetchModelMetadataWithStatus(url, {
            signal: requestController.signal
          })
    } catch {
      return Promise.resolve(failedMetadata)
    }
  })().catch(() => failedMetadata)

  try {
    return await Promise.race([request, aborted])
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abortRequest)
  }
}

export async function resolveTemplateModelMetadata(
  models: readonly ModelFile[],
  { signal }: TemplateModelMetadataOptions = {}
): Promise<TemplateModelMetadataBatchResult> {
  if (signal?.aborted) return { status: 'aborted' }

  const urls = [...new Set(models.map((model) => model.url))]
  const metadataByUrl = new Map<string, ModelMetadataFetchOutcome>()
  let nextUrlIndex = 0

  async function resolveNextUrl(): Promise<void> {
    while (!signal?.aborted) {
      const url = urls[nextUrlIndex++]
      if (url === undefined) return
      metadataByUrl.set(url, await fetchMetadataWithTimeout(url, signal))
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(MAX_CONCURRENT_METADATA_REQUESTS, urls.length) },
      () => resolveNextUrl()
    )
  )

  if (signal?.aborted) return { status: 'aborted' }

  const entries = models.map((model): TemplateModelMetadataEntry => {
    const outcome = metadataByUrl.get(model.url) ?? failedMetadata
    return { model, ...outcome.metadata, resolution: outcome.resolution }
  })

  return { status: 'completed', entries }
}
