import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IWidgetOptions } from '@/lib/litegraph/src/types/widgets'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'

/**
 * The step value for numeric widgets.
 * Use {@link IWidgetOptions.step2} if available, otherwise fallback to
 * {@link IWidgetOptions.step} which is scaled up by 10x in the legacy frontend logic.
 */
export function getWidgetStep(options: IWidgetOptions<unknown>): number {
  return options.step2 || (options.step || 10) * 0.1
}

export function evaluateInput(input: string): number | undefined {
  // Check if input is a valid arithmetic expression (digits, operators, parens)
  if (/^[\d\s.()*+/-]+$/.test(input)) {
    try {
      // Use Function constructor instead of eval — no access to local scope
      const result = new Function(`return (${input})`)()
      if (typeof result === 'number' && !isNaN(result)) {
        return result
      }
    } catch {
      // Ignore evaluation errors
    }
  }
  const newValue = Number(input)
  if (isNaN(newValue)) return undefined
  return newValue
}

export function resolveNodeRootGraphId(
  node: Pick<LGraphNode, 'graph'>
): UUID | undefined
export function resolveNodeRootGraphId(
  node: Pick<LGraphNode, 'graph'>,
  fallbackGraphId: UUID
): UUID
export function resolveNodeRootGraphId(
  node: Pick<LGraphNode, 'graph'>,
  fallbackGraphId?: UUID
): UUID | undefined {
  return node.graph?.rootGraph.id ?? fallbackGraphId
}
