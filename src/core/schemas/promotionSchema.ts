import { z } from 'zod'
import { fromZodError } from 'zod-validation-error'

import type { NodeProperty } from '@/lib/litegraph/src/LGraphNode'

const proxyWidgetStateSchema = z.object({ value: z.unknown() })
/**
 * Order is load-bearing: `z.union` tries variants in declared order and the
 * first match wins. The 4-tuple (with optional trailing state) must come
 * before the 3- and 2-tuple variants, otherwise a 4-tuple would match the
 * 3-tuple form (dropping the trailing state object).
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
export type ProxyWidgetsProperty = z.infer<typeof proxyWidgetsPropertySchema>
export type ProxyWidgetEntry = ProxyWidgetsProperty[number]

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
