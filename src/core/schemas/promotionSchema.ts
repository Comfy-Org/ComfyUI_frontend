import { z } from 'zod'
import { fromZodError } from 'zod-validation-error'

import type { NodeProperty } from '@/lib/litegraph/src/LGraphNode'

const proxyWidgetStateSchema = z.object({ value: z.unknown() })
/**
 * Ordering is defensive: longest tuple first, though `z.tuple` also enforces
 * exact arity so a 4-tuple cannot match the 3-tuple form by length alone.
 */
const proxyWidgetTupleSchema = z.union([
  z.tuple([
    z.string(),
    z.string(),
    z.union([z.string(), z.null()]),
    proxyWidgetStateSchema
  ]),
  z.tuple([z.string(), z.string(), z.string()]),
  z.tuple([z.string(), z.string()])
])
const proxyWidgetsPropertySchema = z.array(proxyWidgetTupleSchema)
type ProxyWidgetsProperty = z.infer<typeof proxyWidgetsPropertySchema>
type ProxyWidgetEntry = ProxyWidgetsProperty[number]

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

/**
 * Typed accessor for the optional trailing `{ value }` state on a proxyWidgets
 * entry. Returns undefined for 2- and 3-tuple (identity-only) entries.
 *
 * Zod infers the state object as `{ value?: unknown }` because `z.unknown()`
 * treats undefined as valid input.
 */
export function getProxyWidgetInlineState(
  entry: ProxyWidgetEntry
): { value?: unknown } | undefined {
  return entry.length === 4 ? entry[3] : undefined
}
