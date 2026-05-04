import { z } from 'zod'
import { fromZodError } from 'zod-validation-error'

import type { NodeProperty } from '@/lib/litegraph/src/LGraphNode'

export const serializedProxyWidgetTupleSchema = z.tuple([
  z.string(),
  z.string()
])
export type SerializedProxyWidgetTuple = z.infer<
  typeof serializedProxyWidgetTupleSchema
>

const legacyProxyWidgetTupleSchema = z.tuple([
  z.string(),
  z.string(),
  z.string()
])

export const proxyWidgetTupleSchema = z.union([
  legacyProxyWidgetTupleSchema,
  serializedProxyWidgetTupleSchema
])
export type ProxyWidgetTuple = z.infer<typeof proxyWidgetTupleSchema>

const proxyWidgetsPropertySchema = z.array(proxyWidgetTupleSchema)
type ProxyWidgetsProperty = z.infer<typeof proxyWidgetsPropertySchema>

export function parseProxyWidgets(
  property: NodeProperty | undefined
): ProxyWidgetsProperty {
  try {
    if (typeof property === 'string') property = JSON.parse(property)
    const result = proxyWidgetsPropertySchema.safeParse(
      typeof property === 'string' ? JSON.parse(property) : property
    )
    if (result.success) return result.data

    const error = fromZodError(result.error)
    console.warn(`Invalid assignment for properties.proxyWidgets:\n${error}`)
  } catch (e) {
    console.warn('Failed to parse properties.proxyWidgets:', e)
  }
  return []
}
