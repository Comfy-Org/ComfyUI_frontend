import { z } from 'zod'
import { fromZodError } from 'zod-validation-error'

import type { NodeProperty } from '@/lib/litegraph/src/LGraphNode'

const proxyWidgetsPropertySchema = z.array(z.tuple([z.string(), z.string()]))
type ProxyWidgetsProperty = z.infer<typeof proxyWidgetsPropertySchema>

export function parseProxyWidgets(
  property: NodeProperty | undefined
): ProxyWidgetsProperty {
  if (typeof property !== 'string') {
    throw new Error(
      'Invalid assignment for properties.proxyWidgets:\nValue must be a string'
    )
  }
  const parsed = JSON.parse(property)
  const result = proxyWidgetsPropertySchema.safeParse(parsed)
  if (result.success) return result.data

  const error = fromZodError(result.error)
  throw new Error(`Invalid assignment for properties.proxyWidgets:\n${error}`)
}
