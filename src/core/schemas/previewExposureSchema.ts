import { z } from 'zod'
import { fromZodError } from 'zod-validation-error'

import type { NodeProperty } from '@/lib/litegraph/src/LGraphNode'
import { tryAsNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'

const previewExposureSchema = z.object({
  name: z.string(),
  sourceNodeId: z
    .union([z.number(), z.string()])
    .transform(tryAsNodeId)
    .refine((value): value is NodeId => value !== null, 'Invalid NodeId'),
  sourcePreviewName: z.string()
})
export type PreviewExposure = z.infer<typeof previewExposureSchema>

const previewExposuresPropertySchema = z.array(previewExposureSchema)

export function parsePreviewExposures(
  property: NodeProperty | undefined
): PreviewExposure[] {
  if (property === undefined) return []

  let parsed: unknown
  try {
    parsed = typeof property === 'string' ? JSON.parse(property) : property
  } catch (e) {
    console.warn('Failed to parse properties.previewExposures:', e)
    return []
  }

  const result = previewExposuresPropertySchema.safeParse(parsed)
  if (result.success) return result.data

  const error = fromZodError(result.error)
  console.warn(`Invalid assignment for properties.previewExposures:\n${error}`)
  return []
}
