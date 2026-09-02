import { z } from 'zod'

import type { NodeProperty } from '@/lib/litegraph/src/LGraphNode'

import { parseNodePropertyArray } from './parseNodePropertyArray'

export const serializedProxyWidgetTupleSchema = z.union([
  z.tuple([z.string(), z.string(), z.string()]),
  z.tuple([z.string(), z.string()])
])
export type SerializedProxyWidgetTuple = z.infer<
  typeof serializedProxyWidgetTupleSchema
>
const proxyWidgetsPropertySchema = z.array(serializedProxyWidgetTupleSchema)
type ProxyWidgetsProperty = z.infer<typeof proxyWidgetsPropertySchema>

export function parseProxyWidgets(
  property: NodeProperty | undefined
): ProxyWidgetsProperty {
  return parseNodePropertyArray(
    property,
    proxyWidgetsPropertySchema,
    'properties.proxyWidgets'
  )
}
