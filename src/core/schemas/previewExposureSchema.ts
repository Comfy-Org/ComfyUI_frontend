import { z } from 'zod'
import { fromZodError } from 'zod-validation-error'

import type { NodeProperty } from '@/lib/litegraph/src/LGraphNode'

export const previewExposureSchema = z.object({
  name: z.string(),
  sourceNodeId: z.string(),
  sourcePreviewName: z.string()
})
export type PreviewExposure = z.infer<typeof previewExposureSchema>

export const previewExposuresPropertySchema = z.array(previewExposureSchema)

export function parsePreviewExposures(
  property: NodeProperty | undefined
): PreviewExposure[] {
  try {
    if (typeof property === 'string') property = JSON.parse(property)
    const result = previewExposuresPropertySchema.safeParse(
      typeof property === 'string' ? JSON.parse(property) : property
    )
    if (result.success) return result.data

    const error = fromZodError(result.error)
    console.warn(
      `Invalid assignment for properties.previewExposures:\n${error}`
    )
  } catch (e) {
    console.warn('Failed to parse properties.previewExposures:', e)
  }
  return []
}
