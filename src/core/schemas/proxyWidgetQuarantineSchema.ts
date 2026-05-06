import { z } from 'zod'
import { fromZodError } from 'zod-validation-error'

import type { NodeProperty } from '@/lib/litegraph/src/LGraphNode'
import type { TWidgetValue } from '@/lib/litegraph/src/types/widgets'

import { serializedProxyWidgetTupleSchema } from './promotionSchema'

export const proxyWidgetQuarantineReasonSchema = z.enum([
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

export const proxyWidgetErrorQuarantineEntrySchema = z.object({
  originalEntry: serializedProxyWidgetTupleSchema,
  reason: proxyWidgetQuarantineReasonSchema,
  hostValue: z.unknown().optional(),
  attemptedAtVersion: z.literal(1)
})

export const proxyWidgetErrorQuarantinePropertySchema = z.array(
  proxyWidgetErrorQuarantineEntrySchema
)

export type ProxyWidgetErrorQuarantineEntry = Omit<
  z.infer<typeof proxyWidgetErrorQuarantineEntrySchema>,
  'hostValue'
> & { hostValue?: TWidgetValue }

export function parseProxyWidgetErrorQuarantine(
  property: NodeProperty | undefined
): ProxyWidgetErrorQuarantineEntry[] {
  try {
    const result = proxyWidgetErrorQuarantinePropertySchema.safeParse(
      typeof property === 'string' ? JSON.parse(property) : property
    )
    if (result.success) return result.data as ProxyWidgetErrorQuarantineEntry[]

    const error = fromZodError(result.error)
    console.warn(
      `Invalid assignment for properties.proxyWidgetErrorQuarantine:\n${error}`
    )
  } catch (e) {
    console.warn('Failed to parse properties.proxyWidgetErrorQuarantine:', e)
  }
  return []
}
