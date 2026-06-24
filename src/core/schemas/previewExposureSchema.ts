import { z } from 'zod'

import type { NodeProperty } from '@/lib/litegraph/src/LGraphNode'
import { nodeId } from '@/types/nodeId'

import { parseNodePropertyArray } from './parseNodePropertyArray'

const previewExposureSchema = z.object({
  name: z.string(),
  sourceNodeId: z.string().transform(nodeId),
  sourcePreviewName: z.string()
})
export type PreviewExposure = z.infer<typeof previewExposureSchema>

const previewExposuresPropertySchema = z.array(previewExposureSchema)

export function parsePreviewExposures(
  property: NodeProperty | undefined
): PreviewExposure[] {
  return parseNodePropertyArray<PreviewExposure>(
    property,
    previewExposuresPropertySchema,
    'properties.previewExposures'
  )
}
