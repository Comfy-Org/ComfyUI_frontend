import type { ModelFile } from '@/platform/workflow/validation/schemas/workflowSchema'

type ModelMetadata = {
  fileSize: number | null
  gatedRepoUrl: string | null
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
  fetchMetadata?: (url: string) => Promise<ModelMetadata>
  signal?: AbortSignal
}

type MetadataResolution = ModelMetadata & {
  resolution: 'resolved' | 'failed'
}

async function fetchDefaultMetadata(url: string): Promise<MetadataResolution> {
  const { fetchModelMetadataWithStatus } =
    await import('@/platform/missingModel/missingModelDownload')
  const { metadata, resolution } = await fetchModelMetadataWithStatus(url)
  return { ...metadata, resolution }
}

async function resolveMetadata(
  url: string,
  fetchMetadata?: (url: string) => Promise<ModelMetadata>
): Promise<MetadataResolution> {
  try {
    if (!fetchMetadata) return fetchDefaultMetadata(url)

    return {
      ...(await fetchMetadata(url)),
      resolution: 'resolved'
    }
  } catch {
    return {
      fileSize: null,
      gatedRepoUrl: null,
      resolution: 'failed'
    }
  }
}

export async function resolveTemplateModelMetadata(
  models: readonly ModelFile[],
  { fetchMetadata, signal }: TemplateModelMetadataOptions = {}
): Promise<TemplateModelMetadataBatchResult> {
  if (signal?.aborted) return { status: 'aborted' }

  const metadataByUrl = new Map<string, Promise<MetadataResolution>>()
  const entries = await Promise.all(
    models.map(async (model): Promise<TemplateModelMetadataEntry> => {
      let metadata = metadataByUrl.get(model.url)
      if (!metadata) {
        metadata = resolveMetadata(model.url, fetchMetadata)
        metadataByUrl.set(model.url, metadata)
      }

      return { model, ...(await metadata) }
    })
  )

  return signal?.aborted
    ? { status: 'aborted' }
    : { status: 'completed', entries }
}
