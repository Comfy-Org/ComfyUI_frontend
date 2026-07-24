import type { z } from 'zod'
import { fromZodError } from 'zod-validation-error'

import type { NodeProperty } from '@/lib/litegraph/src/LGraphNode'

/**
 * @param property - Raw node property value.
 * @param schema - Zod schema describing the expected array shape.
 * @param contextName - Prefix for `console.warn` messages (e.g. `properties.proxyWidgets`).
 */
export function parseNodePropertyArray<T>(
  property: NodeProperty | undefined,
  schema: z.ZodType<T[], z.ZodTypeDef, unknown>,
  contextName: string
): T[] {
  if (property === undefined) return []

  let parsed: unknown
  try {
    parsed = typeof property === 'string' ? JSON.parse(property) : property
  } catch (e) {
    console.warn(`Failed to parse ${contextName}:`, e)
    return []
  }

  const result = schema.safeParse(parsed)
  if (result.success) return result.data

  const error = fromZodError(result.error)
  console.warn(`Invalid assignment for ${contextName}:\n${error}`)
  return []
}
