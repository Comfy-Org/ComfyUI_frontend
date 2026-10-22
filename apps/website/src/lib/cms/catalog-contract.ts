import type { ContentCatalogProjection } from '@comfyorg/ingest-types'
import type { zContentCatalogProjection } from '@comfyorg/ingest-types/zod'

export function normalizeProjection(
  value: ReturnType<typeof zContentCatalogProjection.parse>
): ContentCatalogProjection | undefined {
  const revision = Number(value.revision_id)
  const generation = Number(value.generation)
  if (!Number.isSafeInteger(revision) || !Number.isSafeInteger(generation))
    return undefined
  const items = value.items.map((item) => ({
    ...item,
    revision: Number(item.revision)
  }))
  if (
    items.some(
      (item) => !Number.isSafeInteger(item.revision) || item.revision > revision
    )
  )
    return undefined
  return { revision_id: revision, generation, items }
}
