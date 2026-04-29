import { z } from 'zod'
import { fromZodError } from 'zod-validation-error'

import type { NodeProperty } from '@/lib/litegraph/src/LGraphNode'

type DefinedProxyWidgetValue =
  | null
  | boolean
  | number
  | string
  | bigint
  | symbol
  | object

const definedValueSchema = z.custom<DefinedProxyWidgetValue>(
  (value) => value !== undefined,
  'Inline proxy widget value cannot be undefined'
)
const proxyWidgetStateSchema = z.object({ value: definedValueSchema })
const proxyWidgetTupleSchema = z.union([
  // 4-tuple is read-only migration shim (legacy PR #11559 workflows).
  // Writer never emits this shape.
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
type ProxyWidgetInlineState = z.infer<typeof proxyWidgetStateSchema>

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

/** Returns the optional inline {value} state from a legacy PR #11559 4-tuple entry. */
export function getProxyWidgetInlineState(
  entry: ProxyWidgetEntry
): ProxyWidgetInlineState | undefined {
  return entry.length === 4 ? entry[3] : undefined
}
