import type { z } from 'zod'
import { fromZodError } from 'zod-validation-error'

import type { NodeProperty } from '@/lib/litegraph/src/LGraphNode'

/**
 * Parses a node property that is expected to deserialize into an array `T[]`.
 *
 * Behavior:
 * - `undefined` → returns `[]` (no warning)
 * - If `property` is a string, attempts `JSON.parse`; on failure, warns and
 *   returns `[]`.
 * - Validates the result with `schema.safeParse`; on failure, warns with the
 *   given `contextName` and returns `[]`.
 * - On success, returns the parsed array.
 *
 * @param property - The raw node property value.
 * @param schema - A zod schema describing the expected array shape.
 * @param contextName - Used as the prefix for `console.warn` messages
 *   (e.g. `properties.proxyWidgets`).
 */
export function parseNodePropertyArray<T>(
  property: NodeProperty | undefined,
  schema: z.ZodType<T[]>,
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
