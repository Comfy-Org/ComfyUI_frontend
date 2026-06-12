import { z } from 'zod'

import type { NodeProperty } from '@/lib/litegraph/src/LGraphNode'

import { parseNodePropertyArray } from './parseNodePropertyArray'

const promotedControlSchema = z.object({
  name: z.string(),
  mode: z.string().optional(),
  filter: z.string().optional()
})
export type PromotedControl = z.infer<typeof promotedControlSchema>

const promotedControlsPropertySchema = z.array(promotedControlSchema)

export function parsePromotedControls(
  property: NodeProperty | undefined
): PromotedControl[] {
  return parseNodePropertyArray(
    property,
    promotedControlsPropertySchema,
    'properties.promotedControls'
  )
}
