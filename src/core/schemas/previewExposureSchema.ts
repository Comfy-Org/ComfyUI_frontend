import { z } from 'zod'

import type { NodeProperty } from '@/lib/litegraph/src/LGraphNode'

import { parseNodePropertyArray } from './parseNodePropertyArray'

const previewExposureSchema = z.object({
  name: z.string(),
  sourceNodeId: z.string(),
  sourcePreviewName: z.string()
})
export type PreviewExposure = z.infer<typeof previewExposureSchema>

const previewExposuresPropertySchema = z.array(previewExposureSchema)

export function parsePreviewExposures(
  property: NodeProperty | undefined
): PreviewExposure[] {
  return parseNodePropertyArray(
    property,
    previewExposuresPropertySchema,
    'properties.previewExposures'
  )
}
