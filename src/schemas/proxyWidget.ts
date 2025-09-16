import { z } from 'zod'
import { fromZodError } from 'zod-validation-error'

import type { NodeProperty } from '@/lib/litegraph/src/LGraphNode'

const proxyWidgetsPropertySchema = z.array(z.tuple([z.string(), z.string()]))
export type ProxyWidgetsProperty = z.infer<typeof proxyWidgetsPropertySchema>

export function parseProxyWidgets(
  property: NodeProperty | undefined
): ProxyWidgetsProperty {
  if (typeof property !== 'string') {
    console.error(`Found non-string value for properties.proxyWidgets`)
    return []
  }
  const parsed = JSON.parse(property)
  const result = proxyWidgetsPropertySchema.safeParse(parsed)
  if (result.success) return result.data ?? []

  const error = fromZodError(result.error)
  console.error(`Invalid assignment for properties.proxyWidgets:\n${error}`)
  return []
}
