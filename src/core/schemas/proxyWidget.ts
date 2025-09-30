import { z } from 'zod'
import { fromZodError } from 'zod-validation-error'

import type { NodeProperty } from '@/lib/litegraph/src/LGraphNode'

const proxyWidgetsPropertySchema = z.array(z.tuple([z.string(), z.string()]))
export type ProxyWidgetsProperty = z.infer<typeof proxyWidgetsPropertySchema>

export function parseProxyWidgets(
  property: NodeProperty | undefined
): ProxyWidgetsProperty {
  const result = proxyWidgetsPropertySchema.safeParse(property)
  if (result.success) return result.data

  const error = fromZodError(result.error)
  throw new Error(`Invalid assignment for properties.proxyWidgets:\n${error}`)
}
