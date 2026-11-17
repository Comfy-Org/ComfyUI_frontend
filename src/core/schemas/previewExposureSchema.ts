import { z } from 'zod'

import type { NodeProperty } from '@comfyorg/graph-model/nodeProperty'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

import { parseNodePropertyArray } from './parseNodePropertyArray'

const previewExposureSchema = z.object({
  name: z.string(),
  sourceNodeId: z.string().transform(toNodeId),
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
