import { z } from 'zod'

import type { NodeProperty } from '@/lib/litegraph/src/LGraphNode'
import type { TWidgetValue } from '@/lib/litegraph/src/types/widgets'

import { parseNodePropertyArray } from './parseNodePropertyArray'
import { serializedProxyWidgetTupleSchema } from './promotionSchema'

const proxyWidgetQuarantineReasonSchema = z.enum([
  'missingSourceNode',
  'missingSourceWidget',
  'missingSubgraphInput',
  'ambiguousSubgraphInput',
  'unlinkedSourceWidget',
  'primitiveBypassFailed'
])
export type ProxyWidgetQuarantineReason = z.infer<
  typeof proxyWidgetQuarantineReasonSchema
>

const proxyWidgetErrorQuarantineEntrySchema = z.object({
  originalEntry: serializedProxyWidgetTupleSchema,
  reason: proxyWidgetQuarantineReasonSchema,
  hostValue: z.unknown().optional(),
  attemptedAtVersion: z.literal(1)
})

const proxyWidgetErrorQuarantinePropertySchema = z.array(
  proxyWidgetErrorQuarantineEntrySchema
)

export type ProxyWidgetErrorQuarantineEntry = Omit<
  z.infer<typeof proxyWidgetErrorQuarantineEntrySchema>,
  'hostValue'
> & { hostValue?: TWidgetValue }

export function parseProxyWidgetErrorQuarantine(
  property: NodeProperty | undefined
): ProxyWidgetErrorQuarantineEntry[] {
  return parseNodePropertyArray(
    property,
    proxyWidgetErrorQuarantinePropertySchema,
    'properties.proxyWidgetErrorQuarantine'
  ) as ProxyWidgetErrorQuarantineEntry[]
}
