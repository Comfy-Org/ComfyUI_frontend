import { fetchModelMetadataWithStatus } from '@/platform/missingModel/missingModelDownload';
import type { ModelMetadata } from '@/platform/missingModel/missingModelDownload';
import type { ModelFile } from '@/platform/workflow/validation/schemas/workflowSchema'

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

export async function resolveTemplateModelMetadata(
  models: readonly ModelFile[],
  { signal }: TemplateModelMetadataOptions = {}
): Promise<TemplateModelMetadataBatchResult> {
  if (signal?.aborted) return { status: 'aborted' }

  const metadataByUrl = new Map<
    string,
    ReturnType<typeof fetchModelMetadataWithStatus>
  >()
  const entries = await Promise.all(
    models.map(async (model): Promise<TemplateModelMetadataEntry> => {
      let metadata = metadataByUrl.get(model.url)
      if (!metadata) {
        metadata = fetchModelMetadataWithStatus(model.url)
        metadataByUrl.set(model.url, metadata)
      }

      const outcome = await metadata
      return { model, ...outcome.metadata, resolution: outcome.resolution }
    })
  )

  return signal?.aborted
    ? { status: 'aborted' }
    : { status: 'completed', entries }
}
